import express from "express";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import listRouter from "./routes/list.js";
import downloadRouter from "./routes/download.js";
import deleteRouter from "./routes/delete.js";
import authRouter from "./routes/auth.js";
import { Strategy as GitLabStrategy } from "passport-gitlab2";
import { 
  acceptLoginChallenge, 
  acceptConsentChallenge, 
  rejectConsentChallenge,
  getConsentRequest 
} from "./util/hydraTokenHelper.js";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import fetch from "node-fetch";
import { gitlabUrlReplaceMiddleware } from "./middlewares/gitlabUrlReplace.js";
import { hydraUrlReplaceMiddleware } from "./middlewares/hydraUrlReplace.js";
// .env読込
dotenv.config();

// 認証設定 - 環境変数からフラグを読み取り（グローバルスコープ）
global.authList = {
  github: process.env.GITHUB === 'TRUE',
  gitlab: process.env.GITLAB === 'TRUE',
  hydra: process.env.HYDRA === 'TRUE',
  // 何も指定されていない場合、認証なしモード
  noAuthRequired: !(process.env.GITHUB === 'TRUE' || process.env.GITLAB === 'TRUE' || process.env.HYDRA === 'TRUE')
};
global.authConfig = {
  github: process.env.GITHUB === 'TRUE',
  gitlab: {
    GITLAB_CLIENT_ID: process.env.GITLAB_CLIENT_ID,
    GITLAB_CLIENT_SECRET: process.env.GITLAB_CLIENT_SECRET,
    OAUTH_CALLBACK_URL: process.env.GITLAB_CALLBACK_URL,
    GITLAB_URL: process.env.GITLAB_URL || 'http://localhost:8929', // ブラウザ向けURLを使用（認証画面表示用）
    GITLAB_URL_INTERNAL: process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929', // 内部通信用URL
    GITLAB_TOKEN_URL_INTERNAL: process.env.GITLAB_TOKEN_URL_INTERNAL || "http://gitlab:8929/oauth/token",
    GITLAB_USERINFO_URL_INTERNAL: process.env.GITLAB_USERINFO_URL_INTERNAL || 'http://gitlab:8929/api/v4/user', // 内部通信用ユーザー情報取得URL
  },
  hydra: {
    HYDRA_CLIENT_ID: process.env.HYDRA_CLIENT_ID || "file-explorer-client",
    HYDRA_CLIENT_SECRET: process.env.HYDRA_CLIENT_SECRET || "file-explorer-secret",
    HYDRA_CALLBACK_URL: process.env.HYDRA_CALLBACK_URL || "http://localhost:3000/auth/hydra/callback",
    HYDRA_AUTH_URL: process.env.HYDRA_AUTH_URL || "http://localhost:4444",
    HYDRA_TOKEN_URL_INTERNAL: process.env.HYDRA_TOKEN_URL_INTERNAL || "http://hydra:4444/oauth2/token",
    HYDRA_ADMIN_URL: process.env.HYDRA_ADMIN_URL || "http://localhost:4445",
    HYDRA_ADMIN_URL_INTERNAL: process.env.HYDRA_ADMIN_URL_INTERNAL || "http://hydra:4445",
    HYDRA_USERINFO_URL_INTERNAL: process.env.HYDRA_USERINFO_URL_INTERNAL || "http://hydra:4444/userinfo",
    HYDRA_SCOPE: process.env.HYDRA_SCOPE|| "openid profile email",
  }
};

console.log('[認証設定]', global.authList, global.authConfig);

const app = express();
const PORT = process.env.PORT || 3000;

// セッション
app.set("trust proxy", 1);
app.use(session({
  secret: "file-explorer-secret-key-very-secure-and-long",
  resave: false,
  saveUninitialized: true,  // OAuth stateパラメータのためtrueに変更
  cookie: {
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60,
    httpOnly: true  // セキュリティ向上のため追加
  },
  name: "file-explorer-session",  // セッション名を明示的に設定
  rolling: true  // アクセスごとにセッション期限をリセット
}));

// passport初期化
app.use(passport.initialize());
app.use(passport.session());

// GitLab URL置換ミドルウェア
app.use(gitlabUrlReplaceMiddleware);
// Hydra URL置換ミドルウェア
app.use(hydraUrlReplaceMiddleware);


// JSONボディ
app.use(express.json());
// ルーティング
app.use("/api/list", listRouter);
app.use("/api/download", downloadRouter);
app.use("/api/delete", deleteRouter);
app.use("/auth", authRouter);

// hydra用ログイン画面
app.get("/login", (req, res) => {
  const { login_challenge } = req.query;
  res.send(`
    <form method="post" action="/login">
      <input type="hidden" name="login_challenge" value="${login_challenge || ''}">
      <label>ユーザー名: <input name="username" required></label>
      <button type="submit">ログイン</button>
    </form>
  `);
});

app.post("/login", express.urlencoded({ extended: false }), async (req, res) => {
  console.log("[アクセス] /login POST 受信", req.body);
  const { login_challenge, username } = req.body;
  if (!login_challenge || !username) return res.status(400).send("不正なリクエスト");
  try {
    // hydraTokenHelperを使用してログイン処理を実行
    const acceptData = await acceptLoginChallenge(login_challenge, username);
    console.log("[hydra login accept] 成功:", acceptData);
    if (acceptData.redirect_to) return res.redirect(acceptData.redirect_to);
    // エラー詳細も表示
    return res.status(500).send(`hydra login accept失敗: ${JSON.stringify(acceptData)}`);
  } catch (err) {
    console.error("[hydra login accept] 例外発生:", err);
    return res.status(500).send("hydra login accept例外: " + err.message);
  }
});

app.get("/consent", async (req, res) => {
  const { consent_challenge } = req.query;
  try {
    // hydraTokenHelperを使用してコンセントリクエスト情報を取得
    const data = await getConsentRequest(consent_challenge);
    res.send(`
      <form method="post" action="/consent">
        <input type="hidden" name="consent_challenge" value="${consent_challenge || ''}">
        <div>スコープ: ${(data.requested_scope || []).join(", ")}</div>
        <button type="submit" name="accept" value="1">許可</button>
        <button type="submit" name="accept" value="0">拒否</button>
      </form>
    `);
  } catch (error) {
    console.error("[consent] コンセントリクエスト取得エラー:", error);
    res.status(500).send("コンセント情報取得エラー: " + error.message);
  }
});

app.post("/consent", express.urlencoded({ extended: false }), async (req, res) => {
  const { consent_challenge, accept } = req.body;
  if (!consent_challenge) return res.status(400).send("不正なリクエスト");
  
  try {
    let data;
    if (accept === "1") {
      // 許可: hydraTokenHelperを使用してコンセント受け入れ
      data = await acceptConsentChallenge(consent_challenge, ["openid", "profile", "email"]);
    } else {
      // 拒否: hydraTokenHelperを使用してコンセント拒否
      data = await rejectConsentChallenge(consent_challenge);
    }
    
    // リダイレクト処理
    if (data.redirect_to) return res.redirect(data.redirect_to);
    return res.status(500).send(`hydra consent ${accept === "1" ? "accept" : "reject"}失敗`);
  } catch (error) {
    console.error("[consent] 処理エラー:", error);
    return res.status(500).send(`コンセント処理エラー: ${error.message}`);
  }
});

// 静的ファイル配信
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use((req, res, next) => {
  console.log(`[static前] リクエストパス: ${req.path}`);
  next();
});
app.use(express.static(path.join(__dirname, "../frontend")));

// SPA用catch-all（静的ファイルに該当しない場合のみindex.htmlを返す）
app.get("*", (req, res) => {
  console.log(`[catch-all] index.html返却: ${req.path}`);
  res.sendFile(path.resolve(__dirname, "../frontend/index.html"));
});

// Gitlab OAUTH
passport.use(new GitLabStrategy({
  clientID: global.authConfig.gitlab.GITLAB_CLIENT_ID,
  clientSecret: global.authConfig.gitlab.GITLAB_CLIENT_SECRET,
  callbackURL: global.authConfig.gitlab.OAUTH_CALLBACK_URL,
  baseURL: global.authConfig.gitlab.GITLAB_URL, // ブラウザ向けURLを使用（認証画面表示用）
  tokenURL: global.authConfig.gitlab.GITLAB_TOKEN_URL_INTERNAL, // トークン取得用のエンドポイント（内部URL使用）
  authorizationURL: global.authConfig.gitlab.GITLAB_URL + '/oauth/authorize', // 認証画面URL（ブラウザ向けURL使用）
}, (accessToken, refreshToken, profile, done) => {
  console.log('[gitlab passport] 認証成功:', {
    accessToken: accessToken.substring(0, 20) + '...',
    refreshToken: refreshToken ? refreshToken.substring(0, 20) + '...' : 'なし',
    profile: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName
    }
  });
  return done(null, profile);
}));

// hydra OAUTH2
passport.use("hydra", new OAuth2Strategy({
  authorizationURL: global.authConfig.hydra.HYDRA_AUTH_URL, // ブラウザアクセス用URL
  tokenURL: global.authConfig.hydra.HYDRA_TOKEN_URL_INTERNAL, // Docker環境ではhydra:4444を優先
  clientID: global.authConfig.hydra.HYDRA_CLIENT_ID,
  clientSecret: global.authConfig.hydra.HYDRA_CLIENT_SECRET,
  callbackURL: global.authConfig.hydra.HYDRA_CALLBACK_URL,
  scope: global.authConfig.hydra.HYDRA_SCOPE || "openid profile email",
  skipUserProfile: true, // UserProfile取得をスキップ
  state: true, // CSRF保護を有効化
  passReqToCallback: true // reqオブジェクトをコールバックに渡す
}, (req, accessToken, refreshToken, profile, done) => {
  // hydraはprofile情報をid_tokenで返すため、ここでprofile取得処理を追加してもよい
  // 必要に応じてjwtデコード等でprofileを構築
  console.log('[hydra passport] 認証成功', {
    accessToken: typeof accessToken === 'string' ? accessToken.substring(0, 20) + '...' : String(accessToken).substring(0, 20) + '...',
    refreshToken: typeof refreshToken === 'string' ? refreshToken.substring(0, 20) + '...' : String(refreshToken || 'none').substring(0, 20) + '...',
    refreshTokenType: typeof refreshToken
  });
  console.log('[hydra passport] セッションID:', req.session?.id);
  return done(null, { accessToken, refreshToken, profile });
}));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error("エラー発生:", err);
  res.status(500).json({ error: "サーバ内部エラーが発生しました" });
});

app.listen(PORT, () => {
  console.log(`サーバ起動: http://localhost:${PORT}`);
});
