import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import * as sourceMapSupport from 'source-map-support';
import express from "express";
import session from "express-session";
import passport from "passport";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import listRouter from "./routes/list.js";
import downloadRouter from "./routes/download.js";
import deleteRouter from "./routes/delete.js";
import authRouter from "./routes/auth.js";
import testAuthRouter from "./routes/test-auth.js";
import rootPathsRouter from "./routes/rootpaths.js";
import uploadRouter from "./routes/upload.js";
import permissionsRouter from "./routes/permissions.js";
import renameRouter from "./routes/rename.js";
import { 
  acceptLoginChallenge, 
  acceptConsentChallenge, 
  rejectConsentChallenge,
  getConsentRequest 
} from "./util/hydraTokenHelper.js";
import { gitlabUrlReplaceMiddleware } from "./middlewares/gitlabUrlReplace.js";
import { hydraUrlReplaceMiddleware } from "./middlewares/hydraUrlReplace.js";
import { loginUser, initializeAllowedEmails } from "./services/userService.js";
import { initializeAuthorization } from "./services/authorizationService.js";
import cors from "cors"; // CORSミドルウェアをインポート

//デバッグ用のsourceMap設定
sourceMapSupport.install();
// .env読込
dotenv.config();

const WEB_ROOT_PATH = (process.env.WEB_ROOT_PATH || "/").replace(/(^\/+|\/+?$)/g, ""); // 先頭・末尾のスラッシュを除去
const rootPrefix = WEB_ROOT_PATH ? `/${WEB_ROOT_PATH}/`.replace(/\/+/g, "/") : "/";
console.log("[WEB_ROOT_PATH] 設定されたWEB_ROOT_PATH:", WEB_ROOT_PATH);

// 認可設定ファイルパス
global.config = {
  authorizationConfigPath: process.env.AUTHORIZATION_CONFIG_PATH || path.resolve(process.cwd(), "conf/authorization-config.json"),
  rootPrefix: rootPrefix
};

// 認証プロバイダー設定ファイルのパス
const providerConfigPath = process.env.AUTHORIZATION_PROVIDER_CONFIG_PATH || path.resolve(process.cwd(), "conf/authorization-provider-config.json");
let providerConfig = null;
try {
  const raw = fs.readFileSync(providerConfigPath, "utf8");
  providerConfig = JSON.parse(raw);
  console.log('[認証プロバイダー設定] 読み込み成功:', providerConfigPath);
} catch (e) {
  console.error('[認証プロバイダー設定] 読み込み失敗:', providerConfigPath, e);
  providerConfig = { providers: []};
}


// 新構造: providers: { [fqdn]: { [PROVIDER]: { ... } } }
global.authList = {};
global.authConfig = {};// authList: 各プロバイダーの有効/無効フラグ
try {
  if (providerConfig.providers && typeof providerConfig.providers === 'object') {
    for (const fqdn of Object.keys(providerConfig.providers)) {
      _processProviderConfigForFqdn(fqdn, providerConfig.providers[fqdn]);
    }
  }
} catch (error) {
  console.error('[認証プロバイダー設定] 読み込みエラー:', error);
}

function _processProviderConfigForFqdn(fqdn, providersObj) {
  const enabledProviders = {};
  for (const [providerName, providerObj] of Object.entries(providersObj || {})) {
    if (providerObj && providerObj.enabled) enabledProviders[providerName] = providerObj;
  }
  console.log(`[認証プロバイダー設定] FQDN: ${fqdn}, 有効プロバイダー数: ${Object.keys(enabledProviders).length}`, enabledProviders);
  global.authList[fqdn] = { noAuthRequired: false };
  global.authConfig[fqdn] = {};
  for (const providerName of Object.keys(enabledProviders)) {
    const provConfig = enabledProviders[providerName];
    global.authList[fqdn][providerName] = !!provConfig.enabled;
    global.authConfig[fqdn][providerName] = { ...provConfig };
  }
  global.authList[fqdn].noAuthRequired = Object.keys(enabledProviders).length === 0;
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
app.use(`${rootPrefix}dist`, express.static(path.join(process.cwd(), 'dist')));
// assetsパスをdist/assetsに配信（SPA対応）
app.use(`${rootPrefix}assets`, express.static(path.join(process.cwd(), 'dist/assets')));
// index.htmlのみWEB_ROOT_PATHを埋め込んで返す
app.get(`${rootPrefix}`, async (req, res) => {
  const indexPath = path.join(process.cwd(), 'src/frontend/index.html');
  try {
    let html = await fs.promises.readFile(indexPath, 'utf8');
    html = html.replace('__WEB_ROOT_PATH__', rootPrefix.replace(/\/$/, ''));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    console.error('[index.html配信エラー]', e);
    res.status(500).send('index.htmlの配信に失敗しました');
  }
});
// その他静的ファイル
app.use(rootPrefix, express.static(path.join(process.cwd(), "src/frontend")));
// CSS ファイルの配信（正しいMIMEタイプを設定）
app.use(`${rootPrefix}styles`, (req, res, next) => {
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
app.use(`${rootPrefix}api/list`, listRouter);
app.use(`${rootPrefix}api/download`, downloadRouter);
app.use(`${rootPrefix}api/delete`, deleteRouter);
app.use(`${rootPrefix}api/rootpaths`, rootPathsRouter);
app.use(`${rootPrefix}api/upload`, uploadRouter);
app.use(`${rootPrefix}api/permissions`, permissionsRouter);
app.use(`${rootPrefix}api/rename`, renameRouter);
app.use(`${rootPrefix}auth`, authRouter);
app.use(`${rootPrefix}test/auth`, testAuthRouter);

// hydra用ログイン画面
app.get(`${rootPrefix}login`, (req, res) => {
  const { login_challenge } = req.query;
  try {
    const html = renderTemplate('login', { login_challenge });
    res.send(html);
  } catch (error) {
    console.error("[login] テンプレートレンダリングエラー:", error);
    res.status(500).send("ログイン画面の表示でエラーが発生しました");
  }
});

app.post(`${rootPrefix}login`, express.urlencoded({ extended: false }), async (req, res) => {
  console.log("[アクセス] /login POST 受信", req.body);
  const { login_challenge, username, email } = req.body;

  // 入力検証
  const invalid = _validateLoginInput(login_challenge, username);
  if (invalid) return _renderError(res, { title: '入力エラー', message: invalid.message, backLink: `/login?login_challenge=${login_challenge}`, status: invalid.status });

  // Email 正規化
  const finalEmail = _computeFinalEmail(username, email);

  try {
    const result = _processLogin(username, finalEmail, req);
  if (!result.isAuthorized) return _renderError(res, { title: 'アクセス拒否', message: `申し訳ございません。お使いのメールアドレス「${finalEmail}」はこのシステムにアクセスする権限がありません。`, backLink: `/login?login_challenge=${login_challenge}`, status: 403 });

    // セッションに保存
    req.session.users = req.session.users || {};
    req.session.users[username] = result.user;

    // Hydra による accept
    const subject = JSON.stringify({ username: result.user.username, email: result.user.email, userId: result.user.id });
    const acceptData = await acceptLoginChallenge(req, login_challenge, subject);
    console.log("[hydra login accept] 成功:", acceptData);
    if (acceptData.redirect_to) return res.redirect(acceptData.redirect_to);
    return res.status(500).send(`hydra login accept失敗: ${JSON.stringify(acceptData)}`);
  } catch (err) {
    console.error("[hydra login accept] 例外発生:", err);
  return _renderError(res, { title: '認証エラー', message: `認証処理中にエラーが発生しました: ${err.message}`, backLink: `/login?login_challenge=${login_challenge}`, status: 500 });
  }
});

// --- helpers for login ---
function _validateLoginInput(login_challenge, username) {
  if (!login_challenge || !username) return { message: 'ユーザー名とlogin_challengeは必須項目です。', status: 400 };
  return null;
}

function _computeFinalEmail(username, email) {
  if (email) return email;
  if (username === 'testuser') return 'testuser@example.com';
  return `${username}@example.com`;
}

function _processLogin(username, finalEmail) {
  const loginResult = loginUser(username, finalEmail);
  console.log("[ユーザーログイン結果]", loginResult);
  return loginResult;
}

function _renderError(res, { title, message, backLink = null, status = 500 }) {
  try {
    const html = renderTemplate('error', { title, message, backLink });
    return res.status(status).send(html);
  } catch (err) {
    console.error('[テンプレートエラー]', err);
    return res.status(status).send(message);
  }
}

app.get(`${rootPrefix}consent`, async (req, res) => {
  const { consent_challenge } = req.query;
  try {
    // hydraTokenHelperを使用してコンセントリクエスト情報を取得
    const data = await getConsentRequest(req, consent_challenge);
    
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

app.post(`${rootPrefix}consent`, express.urlencoded({ extended: false }), async (req, res) => {
  const { consent_challenge, accept } = req.body;
  if (!consent_challenge) return res.status(400).send("不正なリクエスト");
  
  try {
    // コンセントリクエスト情報を取得してユーザー情報を抽出
    const consentRequestData = await getConsentRequest(req, consent_challenge);
    let userInfo = null;
    try {
      userInfo = JSON.parse(consentRequestData.subject || '{}');
    } catch (e) {
      userInfo = { username: consentRequestData.subject, email: '' };
    }
    
    let data;
    if (accept === "1") {
      // 許可: hydraTokenHelperを使用してコンセント受け入れ（ユーザー情報付き）
      data = await acceptConsentChallenge(req, consent_challenge, ["openid", "profile", "email"], userInfo);
      console.log("[consent accept] ユーザー情報を含めてコンセント受け入れ:", userInfo);
    } else {
      // 拒否: hydraTokenHelperを使用してコンセント拒否
      data = await rejectConsentChallenge(req, consent_challenge);
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

// --- パスポート戦略のグローバル初期化はFQDNごとの設定に対応できないためコメントアウト ---
// 必要に応じてauth.js側でFQDNごとにStrategyを登録してください

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

// エラーハンドリング
app.use((err, req, res, next) => {
  // next は Express のエラーハンドラシグネチャのために受け取るが、
  // 現状では未使用のため void で参照して lint を回避する
  void next;
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
