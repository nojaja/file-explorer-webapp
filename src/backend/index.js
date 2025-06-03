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
import testAuthRouter from "./routes/test-auth.js";
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
  authorizationConfigPath: process.env.AUTHORIZATION_CONFIG_PATH || "./authorization-config.json"
}

console.log('[認証設定]', global.authList, global.authConfig, global.config);

// 認可システムを初期化
initializeAuthorization();
// 初期化
initializeAllowedEmails();
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

// 静的ファイルの配信
// DockerのランタイムステージのWORKDIR /app を基準にする
// process.cwd() は /app を指す想定
app.use(express.static(path.join(process.cwd(), "src/frontend")));

// JSONボディ
app.use(express.json());
// ルーティング
app.use("/api/list", listRouter);
app.use("/api/download", downloadRouter);
app.use("/api/delete", deleteRouter);
app.use("/test/auth", testAuthRouter);
app.use("/auth", authRouter);
app.use("/test/auth", testAuthRouter);

// hydra用ログイン画面
app.get("/login", (req, res) => {
  const { login_challenge } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ログイン - ファイルエクスプローラ</title>
      <style>
        body { font-family: 'Segoe UI', 'Noto Sans JP', sans-serif; background: #f5f5f5; margin: 0; padding: 2rem; }
        .login-container { max-width: 400px; margin: 2rem auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 2rem; }
        .login-header { text-align: center; margin-bottom: 2rem; color: #1976d2; font-size: 1.5rem; font-weight: 600; }
        .form-group { margin-bottom: 1.5rem; }
        label { display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500; }
        input[type="text"], input[type="email"] { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
        input[type="text"]:focus, input[type="email"]:focus { outline: none; border-color: #1976d2; box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2); }
        .login-btn { width: 100%; padding: 0.75rem; font-size: 1rem; border: none; border-radius: 4px; background: #1976d2; color: #fff; cursor: pointer; transition: background 0.2s; }
        .login-btn:hover { background: #1565c0; }
        .error { color: #d32f2f; margin-top: 0.5rem; font-size: 0.9rem; }
        .required { color: #d32f2f; }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="login-header">ログイン</div>
        <form method="post" action="/login" id="loginForm">
          <input type="hidden" name="login_challenge" value="${login_challenge || ''}">
          
          <div class="form-group">
            <label for="username">ユーザー名 <span class="required">*</span></label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div class="form-group">
            <label for="email">メールアドレス <span class="required">*</span></label>
            <input type="email" id="email" name="email" required>
            <div id="emailError" class="error" style="display: none;"></div>
          </div>
          
          <button type="submit" class="login-btn">ログイン</button>
        </form>
      </div>
      
      <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
          const email = document.getElementById('email').value;
          const emailError = document.getElementById('emailError');
          
          // 簡単なメール形式チェック
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            e.preventDefault();
            emailError.textContent = '有効なメールアドレスを入力してください';
            emailError.style.display = 'block';
            return false;
          }
          
          emailError.style.display = 'none';
        });
      </script>
    </body>
    </html>
  `);
});

app.post("/login", express.urlencoded({ extended: false }), async (req, res) => {
  console.log("[アクセス] /login POST 受信", req.body);
  const { login_challenge, username, email } = req.body;
  
  // 入力値検証
  if (!login_challenge || !username || !email) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>エラー</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h2 style="color: #d32f2f;">入力エラー</h2>
        <p>ユーザー名とメールアドレスは必須項目です。</p>
        <a href="/login?login_challenge=${login_challenge}" style="color: #1976d2;">戻る</a>
      </body></html>
    `);
  }
  
  // Email形式検証
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>エラー</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h2 style="color: #d32f2f;">メールアドレスエラー</h2>
        <p>有効なメールアドレス形式で入力してください。</p>
        <a href="/login?login_challenge=${login_challenge}" style="color: #1976d2;">戻る</a>
      </body></html>
    `);
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
      return res.status(403).send(`
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>アクセス拒否</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
          <h2 style="color: #d32f2f;">アクセス拒否</h2>
          <p>申し訳ございません。お使いのメールアドレス「${email}」はこのシステムにアクセスする権限がありません。</p>
          <p>アクセス許可が必要な場合は、システム管理者にお問い合わせください。</p>
          <a href="/login?login_challenge=${login_challenge}" style="color: #1976d2;">戻る</a>
        </body></html>
      `);
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
    return res.status(500).send(`hydra login accept失敗: ${JSON.stringify(acceptData)}`);
  } catch (err) {
    console.error("[hydra login accept] 例外発生:", err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>エラー</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h2 style="color: #d32f2f;">認証エラー</h2>
        <p>認証処理中にエラーが発生しました: ${err.message}</p>
        <a href="/login?login_challenge=${login_challenge}" style="color: #1976d2;">戻る</a>
      </body></html>
    `);
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
    
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>アクセス許可 - ファイルエクスプローラ</title>
        <style>
          body { font-family: 'Segoe UI', 'Noto Sans JP', sans-serif; background: #f5f5f5; margin: 0; padding: 2rem; }
          .consent-container { max-width: 500px; margin: 2rem auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 2rem; }
          .consent-header { text-align: center; margin-bottom: 2rem; color: #1976d2; font-size: 1.5rem; font-weight: 600; }
          .user-info { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; }
          .scope-list { margin: 1.5rem 0; }
          .scope-item { background: #e3f2fd; padding: 0.5rem 1rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid #1976d2; }
          .button-group { display: flex; gap: 1rem; margin-top: 2rem; }
          .consent-btn { flex: 1; padding: 0.75rem; font-size: 1rem; border: none; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
          .accept-btn { background: #4caf50; color: #fff; }
          .accept-btn:hover { background: #45a049; }
          .reject-btn { background: #f44336; color: #fff; }
          .reject-btn:hover { background: #da190b; }
        </style>
      </head>
      <body>
        <div class="consent-container">
          <div class="consent-header">アクセス許可の確認</div>
          
          <div class="user-info">
            <strong>ユーザー情報:</strong><br>
            ユーザー名: ${userInfo.username || 'unknown'}<br>
            メールアドレス: ${userInfo.email || 'unknown'}
          </div>
          
          <div>ファイルエクスプローラが以下の情報にアクセスすることを許可しますか？</div>
          
          <div class="scope-list">
            ${(data.requested_scope || []).map(scope => {
              const scopeDesc = {
                'openid': 'OpenID Connect - ログイン認証',
                'profile': 'プロフィール情報（ユーザー名等）',
                'email': 'メールアドレス'
              };
              return `<div class="scope-item">${scopeDesc[scope] || scope}</div>`;
            }).join('')}
          </div>
          
          <form method="post" action="/consent">
            <input type="hidden" name="consent_challenge" value="${consent_challenge || ''}">
            <div class="button-group">
              <button type="submit" name="accept" value="1" class="consent-btn accept-btn">許可</button>
              <button type="submit" name="accept" value="0" class="consent-btn reject-btn">拒否</button>
            </div>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("[consent] コンセントリクエスト取得エラー:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>エラー</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h2 style="color: #d32f2f;">コンセント情報取得エラー</h2>
        <p>エラー: ${error.message}</p>
      </body></html>
    `);
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
    return res.status(500).send(`hydra consent ${accept === "1" ? "accept" : "reject"}失敗`);
  } catch (error) {
    console.error("[consent] 処理エラー:", error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>エラー</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h2 style="color: #d32f2f;">コンセント処理エラー</h2>
        <p>エラー: ${error.message}</p>
        <a href="/consent?consent_challenge=${consent_challenge}" style="color: #1976d2;">戻る</a>
      </body></html>
    `);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`サーバ起動: http://0.0.0.0:${PORT}`);
});
