import express from "express";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import fs from "fs";
import listRouter from "./routes/list.js";
import downloadRouter from "./routes/download.js";
import deleteRouter from "./routes/delete.js";
import authRouter from "./routes/auth.js";
import testAuthRouter from "./routes/test-auth.js";
import rootPathsRouter from "./routes/rootpaths.js";
import uploadRouter from "./routes/upload.js";
import permissionsRouter from "./routes/permissions.js";
import { Strategy as GitLabStrategy } from "passport-gitlab2";
import { 
  acceptLoginChallenge, 
  acceptConsentChallenge, 
  rejectConsentChallenge,
  getConsentRequest 
} from "./util/hydraTokenHelper.js";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import { gitlabUrlReplaceMiddleware } from "./middlewares/gitlabUrlReplace.js";
import { hydraUrlReplaceMiddleware } from "./middlewares/hydraUrlReplace.js";
import { loginUser, isEmailAuthorized, initializeAllowedEmails} from "./services/userService.js";
import { initializeAuthorization } from "./services/authorizationService.js";
import cors from "cors"; // CORSミドルウェアをインポート
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
global.config = {
  authorizationConfigPath: process.env.AUTHORIZATION_CONFIG_PATH || path.resolve(process.cwd(), "conf/authorization-config.json")
}

console.log('[認証設定]', global.authList, global.authConfig, global.config);
console.log('[認証設定] 認可設定ファイルパス:', global.config.authorizationConfigPath);

// Handlebarsテンプレートヘルパー関数（後で定義される__dirnameを使用）
let templatesDir;
let renderTemplate;

// 認可システムを初期化
initializeAuthorization();
// 初期化
initializeAllowedEmails();
const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定（フロントエンドが同一オリジンでない場合は環境変数で指定）
const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

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
    httpOnly: true,  // セキュリティ向上のため追加
    path: "/"
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

// dist配下のバンドルを静的配信（catch-allより前に追加）
app.use('/dist', express.static(path.join(process.cwd(), 'dist')));
// assetsパスをdist/assetsに配信（SPA対応）
app.use('/assets', express.static(path.join(process.cwd(), 'dist/assets')));
// 既存のfrontend, styles配信
app.use(express.static(path.join(process.cwd(), "src/frontend")));
// CSS ファイルの配信（正しいMIMEタイプを設定）
app.use("/styles", (req, res, next) => {
  const cssPath = path.join(process.cwd(), "src/styles");
  console.log(`[CSS middleware] リクエストパス: ${req.path}, フルパス: ${req.originalUrl}, ファイルパス: ${cssPath}`);
  console.log(`[CSS middleware] process.cwd(): ${process.cwd()}`);
  // ファイル存在確認のためのデバッグ情報
  try {
    const fs = require('fs');
    const files = fs.readdirSync(cssPath);
    console.log(`[CSS middleware] stylesディレクトリ内のファイル:`, files);
    const requestedFile = path.join(cssPath, req.path);
    const exists = fs.existsSync(requestedFile);
    console.log(`[CSS middleware] 要求されたファイル: ${requestedFile}, 存在: ${exists}`);
  } catch (error) {
    console.error(`[CSS middleware] ファイル確認エラー:`, error);
  }
  next();
}, express.static(path.join(process.cwd(), "src/styles"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      console.log(`[CSS headers] CSSファイル配信: ${filePath}, Content-Type: text/css`);
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// JSONボディ
app.use(express.json());

// ルーティング
app.use("/api/list", listRouter);
app.use("/api/download", downloadRouter);
app.use("/api/delete", deleteRouter);
app.use("/api/rootpaths", rootPathsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/test/auth", testAuthRouter);
app.use("/auth", authRouter);
app.use("/test/auth", testAuthRouter);

// hydra用ログイン画面
app.get("/login", (req, res) => {
  const { login_challenge } = req.query;
  try {
    const html = renderTemplate('login', { login_challenge });
    res.send(html);
  } catch (error) {
    console.error("[login] テンプレートレンダリングエラー:", error);
    res.status(500).send("ログイン画面の表示でエラーが発生しました");
  }
});

app.post("/login", express.urlencoded({ extended: false }), async (req, res) => {
  console.log("[アクセス] /login POST 受信", req.body);
  const { login_challenge, username, email } = req.body;
    // 入力値検証
  if (!login_challenge || !username || !email) {
    try {
      const html = renderTemplate('error', {
        title: '入力エラー',
        message: 'ユーザー名とメールアドレスは必須項目です。',
        backLink: `/login?login_challenge=${login_challenge}`
      });
      return res.status(400).send(html);
    } catch (err) {
      console.error('[テンプレートエラー]', err);
      return res.status(500).send('テンプレートエラーが発生しました');
    }
  }
    // Email形式検証
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    try {
      const html = renderTemplate('error', {
        title: 'メールアドレスエラー',
        message: '有効なメールアドレス形式で入力してください。',
        backLink: `/login?login_challenge=${login_challenge}`
      });
      return res.status(400).send(html);
    } catch (err) {
      console.error('[テンプレートエラー]', err);
      return res.status(500).send('テンプレートエラーが発生しました');
    }
  }
    try {
    // デフォルトのテストユーザーの場合、emailが空の可能性があるので補完
    let finalEmail = email;
    if (!email && username === 'testuser') {
      finalEmail = 'testuser@example.com';
      console.log('[ログイン処理] testユーザーにデフォルトemailを設定:', finalEmail);
    } else if (!email) {
      finalEmail = `${username}@example.com`;
      console.log('[ログイン処理] ユーザーにデフォルトemailを設定:', finalEmail);
    }
    
    // ユーザーサービスでユーザー登録/ログイン処理
    const loginResult = loginUser(username, finalEmail);
    console.log("[ユーザーログイン結果]", loginResult);
      // Email認可チェック
    if (!loginResult.isAuthorized) {
      try {
        const html = renderTemplate('error', {
          title: 'アクセス拒否',
          message: `申し訳ございません。お使いのメールアドレス「${email}」はこのシステムにアクセスする権限がありません。\nアクセス許可が必要な場合は、システム管理者にお問い合わせください。`,
          backLink: `/login?login_challenge=${login_challenge}`
        });
        return res.status(403).send(html);
      } catch (error) {
        console.error("[login] エラーテンプレートレンダリングエラー:", error);
        return res.status(403).send("アクセス権限がありません");
      }
    }
    
    // ユーザー情報をセッションに保存
    if (!req.session.users) {
      req.session.users = {};
    }
    req.session.users[username] = loginResult.user;
    
    // hydraTokenHelperを使用してログイン処理を実行
    // ユーザー名とemail情報を含めてsubjectとして渡す
    const subject = JSON.stringify({ 
      username: loginResult.user.username, 
      email: loginResult.user.email,
      userId: loginResult.user.id
    });
    const acceptData = await acceptLoginChallenge(login_challenge, subject);
    
    console.log("[hydra login accept] 成功:", acceptData);
    if (acceptData.redirect_to) return res.redirect(acceptData.redirect_to);
    
    // エラー詳細も表示
    return res.status(500).send(`hydra login accept失敗: ${JSON.stringify(acceptData)}`);  } catch (err) {
    console.error("[hydra login accept] 例外発生:", err);
    try {
      const html = renderTemplate('error', {
        title: '認証エラー',
        message: `認証処理中にエラーが発生しました: ${err.message}`,
        backLink: `/login?login_challenge=${login_challenge}`
      });
      return res.status(500).send(html);
    } catch (error) {
      console.error("[login] エラーテンプレートレンダリングエラー:", error);
      return res.status(500).send("認証処理でエラーが発生しました");
    }
  }
});

app.get("/consent", async (req, res) => {
  const { consent_challenge } = req.query;
  try {
    // hydraTokenHelperを使用してコンセントリクエスト情報を取得
    const data = await getConsentRequest(consent_challenge);
    
    // ユーザー情報をsubjectから取得
    let userInfo = null;
    try {
      userInfo = JSON.parse(data.subject || '{}');
    } catch (e) {
      // subjectがJSON形式でない場合はそのまま使用
      userInfo = { username: data.subject, email: '' };
    }
    
    // スコープの説明を準備
    const scopeDesc = {
      'openid': 'OpenID Connect - ログイン認証',
      'profile': 'プロフィール情報（ユーザー名等）',
      'email': 'メールアドレス'
    };
    
    const scopes = (data.requested_scope || []).map(scope => ({
      name: scope,
      description: scopeDesc[scope] || scope
    }));

    const html = renderTemplate('consent', {
      consent_challenge,
      user: userInfo,
      scopes: scopes
    });
    res.send(html);
  } catch (error) {
    console.error("[consent] コンセントリクエスト取得エラー:", error);
    try {
      const html = renderTemplate('error', {
        title: 'コンセント情報取得エラー',
        message: `エラー: ${error.message}`,
        backLink: null
      });
      res.status(500).send(html);
    } catch (templateError) {
      console.error("[consent] エラーテンプレートレンダリングエラー:", templateError);
      res.status(500).send("コンセント情報の取得でエラーが発生しました");
    }
  }
});

app.post("/consent", express.urlencoded({ extended: false }), async (req, res) => {
  const { consent_challenge, accept } = req.body;
  if (!consent_challenge) return res.status(400).send("不正なリクエスト");
  
  try {
    // コンセントリクエスト情報を取得してユーザー情報を抽出
    const consentRequestData = await getConsentRequest(consent_challenge);
    let userInfo = null;
    try {
      userInfo = JSON.parse(consentRequestData.subject || '{}');
    } catch (e) {
      userInfo = { username: consentRequestData.subject, email: '' };
    }
    
    let data;
    if (accept === "1") {
      // 許可: hydraTokenHelperを使用してコンセント受け入れ（ユーザー情報付き）
      data = await acceptConsentChallenge(consent_challenge, ["openid", "profile", "email"], userInfo);
      console.log("[consent accept] ユーザー情報を含めてコンセント受け入れ:", userInfo);
    } else {
      // 拒否: hydraTokenHelperを使用してコンセント拒否
      data = await rejectConsentChallenge(consent_challenge);
    }
    
    // リダイレクト処理
    if (data.redirect_to) return res.redirect(data.redirect_to);
    return res.status(500).send(`hydra consent ${accept === "1" ? "accept" : "reject"}失敗`);  } catch (error) {
    console.error("[consent] 処理エラー:", error);
    try {
      const html = renderTemplate('error', {
        title: 'コンセント処理エラー',
        message: `エラー: ${error.message}`,
        backLink: `/consent?consent_challenge=${consent_challenge}`
      });
      return res.status(500).send(html);
    } catch (templateError) {
      console.error("[consent] エラーテンプレートレンダリングエラー:", templateError);
      return res.status(500).send("コンセント処理でエラーが発生しました");
    }
  }
});

// 静的ファイル配信
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Handlebarsテンプレートディレクトリとレンダリング関数を定義
templatesDir = path.join(__dirname, "../templates");

// Handlebarsヘルパーを登録（改行をHTMLの<br>に変換）
Handlebars.registerHelper('nl2br', function(text) {
  if (!text) return '';
  return new Handlebars.SafeString(text.replace(/\n/g, '<br>'));
});

renderTemplate = (templateName, data = {}) => {
  try {
    const templatePath = path.join(templatesDir, `${templateName}.hbs`);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);
    return template(data);
  } catch (error) {
    console.error(`[renderTemplate] テンプレート読み込みエラー (${templateName}):`, error);
    throw error;
  }
};

// Gitlab OAUTH
if (global.authConfig && global.authConfig.gitlab && global.authConfig.gitlab.GITLAB_CLIENT_ID) {
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
} else {
  console.log('[gitlab passport] GitLab認証は設定されていません。clientIDが見つかりません。');
}

// hydra OAUTH2
if (global.authConfig && global.authConfig.hydra && global.authConfig.hydra.HYDRA_CLIENT_ID) {  passport.use("hydra", new OAuth2Strategy({
    authorizationURL: global.authConfig.hydra.HYDRA_AUTH_URL, // ブラウザアクセス用URL
    tokenURL: global.authConfig.hydra.HYDRA_TOKEN_URL_INTERNAL, // Docker環境ではhydra:4444を優先
    clientID: global.authConfig.hydra.HYDRA_CLIENT_ID,
    clientSecret: global.authConfig.hydra.HYDRA_CLIENT_SECRET,
    callbackURL: global.authConfig.hydra.HYDRA_CALLBACK_URL,
    scope: global.authConfig.hydra.HYDRA_SCOPE || "openid profile email",
    skipUserProfile: false, // UserProfile取得を有効化してemailなどの情報を取得
    state: true, // CSRF保護を有効化
    passReqToCallback: true, // reqオブジェクトをコールバックに渡す
    userProfileURL: global.authConfig.hydra.HYDRA_USERINFO_URL_INTERNAL // ユーザー情報取得エンドポイント
  }, async (req, accessToken, refreshToken, profile, done) => {
    // ユーザー情報をuserinfoエンドポイントから手動取得（passport-oauth2でprofileが空の場合の対策）
    if (!profile || !profile.email) {
      try {
        const userInfoResponse = await fetch(global.authConfig.hydra.HYDRA_USERINFO_URL_INTERNAL, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          console.log('[hydra passport] userinfoから取得したユーザー情報:', userInfo);
          profile = userInfo;
        }
      } catch (error) {
        console.warn('[hydra passport] userinfoエンドポイントからの情報取得失敗:', error);
      }
    }
    
    // hydraはprofile情報をid_tokenで返すため、ここでprofile取得処理を追加してもよい
    // 必要に応じてjwtデコード等でprofileを構築
    console.log('[hydra passport] 認証成功', {
      accessToken: typeof accessToken === 'string' ? accessToken.substring(0, 20) + '...' : String(accessToken).substring(0, 20) + '...',
      refreshToken: typeof refreshToken === 'string' ? refreshToken.substring(0, 20) + '...' : String(refreshToken || 'none').substring(0, 20) + '...',
      refreshTokenType: typeof refreshToken,
      profile: profile
    });
    console.log('[hydra passport] セッションID:', req.session?.id);
    return done(null, { accessToken, refreshToken, profile });
  }));
} else {
  console.log('[hydra passport] Hydra認証は設定されていません。clientIDが見つかりません。');
}

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

// SPA用catch-all（静的ファイルに該当しない場合のみindex.htmlを返す）
app.get("*", (req, res) => {
  console.log(`[catch-all] パス: ${req.path}, 静的ファイル確認後のindex.html返却`);
  res.sendFile(path.resolve(process.cwd(), "src/frontend/index.html"));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`サーバ起動: http://0.0.0.0:${PORT}`);
});
