import express from "express";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import listRouter from "./routes/list.js";
import downloadRouter from "./routes/download.js";
import deleteRouter from "./routes/delete.js";
import authRouter from "./routes/auth.js";
import { Strategy as GitLabStrategy } from "passport-gitlab2";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import fetch from "node-fetch";
// .env読込
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "http://localhost:4445";
console.log("[起動時] HYDRA_ADMIN_URL:", HYDRA_ADMIN_URL);

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
    // デバッグ: fetch直前のHYDRA_ADMIN_URLを出力
    console.log("[hydra login accept] fetch直前 HYDRA_ADMIN_URL:", HYDRA_ADMIN_URL);
    // hydra admin APIでaccept
    const hydraRes = await fetch(`${HYDRA_ADMIN_URL}/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(login_challenge)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: username })
    });
    const data = await hydraRes.json();
    console.log("[hydra login accept] status:", hydraRes.status, "data:", data); // hydraレスポンス詳細を出力
    if (data.redirect_to) return res.redirect(data.redirect_to);
    // エラー詳細も表示
    return res.status(500).send(`hydra login accept失敗: ${JSON.stringify(data)}`);
  } catch (err) {
    console.error("[hydra login accept] 例外発生:", err);
    return res.status(500).send("hydra login accept例外: " + err.message);
  }
});

app.get("/consent", async (req, res) => {
  const { consent_challenge } = req.query;
  // hydra admin APIでconsentリクエスト内容取得
  const hydraRes = await fetch(`${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(consent_challenge)}`);
  const data = await hydraRes.json();
  res.send(`
    <form method="post" action="/consent">
      <input type="hidden" name="consent_challenge" value="${consent_challenge || ''}">
      <div>スコープ: ${(data.requested_scope || []).join(", ")}</div>
      <button type="submit" name="accept" value="1">許可</button>
      <button type="submit" name="accept" value="0">拒否</button>
    </form>
  `);
});

app.post("/consent", express.urlencoded({ extended: false }), async (req, res) => {
  const { consent_challenge, accept } = req.body;
  if (!consent_challenge) return res.status(400).send("不正なリクエスト");
  if (accept === "1") {
    // 許可: hydra admin APIでaccept
    const hydraRes = await fetch(`${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(consent_challenge)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_scope: ["openid", "profile", "email"], remember: true, remember_for: 3600 })
    });
    const data = await hydraRes.json();
    if (data.redirect_to) return res.redirect(data.redirect_to);
    return res.status(500).send("hydra consent accept失敗");
  } else {
    // 拒否: hydra admin APIでreject
    const hydraRes = await fetch(`${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/reject?consent_challenge=${encodeURIComponent(consent_challenge)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "access_denied", error_description: "ユーザーが拒否しました" })
    });
    const data = await hydraRes.json();
    if (data.redirect_to) return res.redirect(data.redirect_to);
    return res.status(500).send("hydra consent reject失敗");
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
  clientID: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  callbackURL: process.env.OAUTH_CALLBACK_URL,
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

// hydra OAUTH2
passport.use("hydra", new OAuth2Strategy({
  authorizationURL: process.env.HYDRA_AUTH_URL, // ブラウザアクセス用URL
  tokenURL: process.env.HYDRA_TOKEN_URL_INTERNAL || process.env.HYDRA_TOKEN_URL, // Docker環境ではhydra:4444を優先
  clientID: process.env.HYDRA_CLIENT_ID,
  clientSecret: process.env.HYDRA_CLIENT_SECRET,
  callbackURL: process.env.HYDRA_CALLBACK_URL,
  scope: process.env.HYDRA_SCOPE || "openid profile email",
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
