import express from "express";
import GitLabStrategy from "passport-gitlab2";
import OAuth2Strategy from "passport-oauth2";
import passport from "passport";
import { getGitLabToken, getGitLabUserInfo } from "../util/gitlabTokenHelper.js";
import { getHydraToken, getHydraUserInfo, acceptLoginChallenge, acceptConsentChallenge } from "../util/hydraTokenHelper.js";
import { getUserPermissions } from "../services/authorizationService.js";
import { getAuthProviderConfig } from "../authProviderConfig.js";
import * as sourceMapSupport from 'source-map-support'

//デバッグ用のsourceMap設定
sourceMapSupport.install();
const router = express.Router();

// ユーザー情報正規化ヘルパー群（モジュールスコープに移動して route 内の複雑度を下げる）
function _normalizeHydra(u) {
  // u is expected to have .profile
  return {
    email: u.profile.email || null,
    username: u.profile.preferred_username || u.profile.name || null,
    displayName: u.profile.name || u.profile.preferred_username || null,
    avatar: u.profile.picture || null
  };
}

function _normalizeGitLabJson(u) {
  return {
    email: u._json.email || null,
    username: u._json.username || null,
    displayName: u._json.name || u._json.username || null,
    avatar: u._json.avatar_url || null
  };
}

function _normalizeGeneric(u) {
  return {
    email: u.email || null,
    username: u.username || u.name || null,
    displayName: u.name || u.username || null,
    avatar: u.avatar_url || null
  };
}

function normalizeUser(u) {
  if (!u) return { email: null, username: null, displayName: null, avatar: null };
  if (u.profile) return _normalizeHydra(u);
  if (u._json) return _normalizeGitLabJson(u);
  return _normalizeGeneric(u);
}

// Github認証開始
router.get("/github", (req, res, next) => {
  if (!req.session) {
    console.error('[auth/github] セッションが存在しません');
    return res.status(500).send('セッション初期化エラー');
  }
  if (!req.session.oauth2) {
    req.session.oauth2 = {};
  }
  // FQDNからGithub認証設定を取得
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const githubConfig = getAuthProviderConfig(fqdn, 'github');
  if (!githubConfig || !githubConfig.enabled) {
    console.error(`[auth/github] FQDN=${fqdn} のGithub認証設定が無効または未定義`);
    return res.status(403).send('Github認証はこのFQDNで利用できません');
  }
  // 必要なら他の設定値もセッションに保存可能
  req.session.githubAuthConfig = githubConfig;
  passport.authenticate("github", {
    scope: ['user:email']
  })(req, res, next);
});
// Gitlab認証開始
router.get("/gitlab", (req, res, next) => {
  // セッションを初期化（必要な場合）
  if (!req.session) {
    console.error('[auth/gitlab] セッションが存在しません');
    return res.status(500).send('セッション初期化エラー');
  }
  
  // passport-oauth2が期待する形式でsessionにoauth2オブジェクトを初期化
  if (!req.session.oauth2) {
    req.session.oauth2 = {};
  }
  // FQDNからGitLab認証設定を取得
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const gitlabConfig = getAuthProviderConfig(fqdn, 'gitlab');
  if (!gitlabConfig || !gitlabConfig.enabled) {
    console.error(`[auth/gitlab] FQDN=${fqdn} のGitLab認証設定が無効または未定義`);
    return res.status(403).send('GitLab認証はこのFQDNで利用できません');
  }
  // セッションにGitLab URL情報を保存
  req.session.gitlabUrls = {
    gitlabInternalUrl: gitlabConfig.GITLAB_URL_INTERNAL,
    gitlabBrowserUrl: gitlabConfig.GITLAB_URL
  };
  // 必要なら他の設定値もセッションに保存可能
  req.session.gitlabAuthConfig = gitlabConfig;

  // Strategyを都度登録（FQDNごとに設定値が異なるため）
  passport.use("gitlab", new GitLabStrategy({
    clientID: gitlabConfig.GITLAB_CLIENT_ID,
    clientSecret: gitlabConfig.GITLAB_CLIENT_SECRET,
    callbackURL: gitlabConfig.GITLAB_CALLBACK_URL,
    baseURL: gitlabConfig.GITLAB_URL,
    tokenURL: gitlabConfig.GITLAB_URL_INTERNAL + "/oauth/token",
    authorizationURL: gitlabConfig.GITLAB_URL + "/oauth/authorize",
    scope: ["read_user"]
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

  passport.authenticate("gitlab", {
    scope: ['read_user']
  })(req, res, next);
});

// hydra認証開始
router.get("/hydra", (req, res, next) => {
  // セッションを初期化（必要な場合）
  if (!req.session) {
    console.error('[auth/hydra] セッションが存在しません');
    return res.status(500).send('セッション初期化エラー');
  }
  
  // passport-oauth2が期待する形式でsessionにoauth2オブジェクトを初期化
  if (!req.session.oauth2) {
    req.session.oauth2 = {};
  }

  // FQDNごとのHydra認証設定を取得
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const hydraConfig = getAuthProviderConfig(fqdn, 'hydra');
  if (!hydraConfig || !hydraConfig.enabled) {
    console.error(`[auth/hydra] FQDN=${fqdn} のHydra認証設定が無効または未定義`);
    return res.status(403).send('Hydra認証はこのFQDNで利用できません');
  }
  req.session.hydraAuthConfig = hydraConfig;
  console.log("hydraConfig",hydraConfig);

  // Strategyを都度登録（FQDNごとに設定値が異なるため）
  passport.use("hydra", new OAuth2Strategy({
    authorizationURL: hydraConfig.HYDRA_AUTH_URL, // ブラウザアクセス用URL
    tokenURL: hydraConfig.HYDRA_TOKEN_URL_INTERNAL,// Docker環境ではhydra:4444を優先
    clientID: hydraConfig.HYDRA_CLIENT_ID,
    clientSecret: hydraConfig.HYDRA_CLIENT_SECRET,
    callbackURL: hydraConfig.HYDRA_CALLBACK_URL,
    scope: hydraConfig.HYDRA_SCOPE || ["openid", "profile", "email"],
    skipUserProfile: false,// UserProfile取得を有効化してemailなどの情報を取得
    state: true,// CSRF保護を有効化
    passReqToCallback: true, // reqオブジェクトをコールバックに渡す
    userProfileURL: hydraConfig.HYDRA_USERINFO_URL_INTERNAL // ユーザー情報取得エンドポイント
  // このコールバックは外部ライブラリが要求する署名のため max-params を許容する
  /* eslint-disable-next-line max-params */
  }, async (req, accessToken, refreshToken, profile, done) => {
    // ユーザー情報をuserinfoエンドポイントから手動取得（profileが空の場合の対策）
    if (!profile || !profile.email) {
      try {
        const userInfoResponse = await fetch(hydraConfig.HYDRA_USERINFO_URL_INTERNAL, {
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

  // passport認証を開始
  passport.authenticate("hydra", {
    scope: 'openid profile email'
  })(req, res, next);
});

// Hydra login challenge handler
router.get("/login", async (req, res) => {
  const loginChallenge = req.query.login_challenge;
  
  if (!loginChallenge) {
    return res.status(400).send("login_challenge parameter is required");
  }

  try {
    // 簡易実装: 自動的にログインを受け入れる
    // 実際の実装では、ここでユーザー認証を行う
    const acceptData = await acceptLoginChallenge(req, loginChallenge, 'test-user');
    
    return res.redirect(acceptData.redirect_to);
  } catch (error) {
    console.error(`[auth/login] エラー:`, error);
    return res.status(500).send(`Login error: ${error.message}`);
  }
});

// Hydra consent challenge handler  
router.get("/consent", async (req, res) => {
  const consentChallenge = req.query.consent_challenge;
  
  if (!consentChallenge) {
    return res.status(400).send("consent_challenge parameter is required");
  }
  try {
    // テストユーザー情報を準備
    const testUserInfo = {
      username: 'testuser',
      email: 'testuser@example.com'
    };
    
    // コンセントチャレンジを受け入れる
    const acceptData = await acceptConsentChallenge(req, consentChallenge, ['openid', 'profile', 'email'], testUserInfo);
        
    return res.redirect(acceptData.redirect_to);
  } catch (error) {
    console.error(`[auth/consent] エラー:`, error);
    return res.status(500).send(`Consent error: ${error.message}`);
  }
});

// OAUTHコールバック
router.get("/callback", async (req, res, next) => {
  try {
    const handled = await _processOAuthCallback(req, res);
    if (!handled) return next();
    return undefined;
  } catch (err) {
    return next(err);
  }
});

// delegate 実装: 実際の処理を別関数に移動して callback の複雑度を下げる
async function _processOAuthCallback(req, res) {
  console.log(`[auth/callback] コールバック受信`);
  console.log(`[auth/callback] セッションID: ${req.session?.id}`);
  console.log(`[auth/callback] クエリパラメータ:`, req.query);
  console.log(`[auth/callback] OAuth2States:`, req.session?.oauth2States);
  const code = req.query.code;
  const state = req.query.state;
  const isGitLabCallback = req.session?.gitlabUrls && code;
  const isHydraCallback = code && !isGitLabCallback; // GitLabでなければHydraと判断

  if (isGitLabCallback) return await _processGitLabCallback(req, res, code);
  if (isHydraCallback) return await _processHydraCallback(req, res, code, state);
  return false;
}

// helper: GitLab callback 専用ラッパー
async function _processGitLabCallback(req, res, code) {
  try {
    const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
    let gitlabConfig = req.session.gitlabAuthConfig;
    if (!gitlabConfig) gitlabConfig = getAuthProviderConfig(fqdn, 'gitlab');
    if (!gitlabConfig) {
      console.error(`[auth/callback] FQDN=${fqdn} のGitLab認証設定が見つかりません`);
      const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
      res.redirect(prefix + "/?error=gitlab_config");
      return true;
    }
    const handled = await _handleGitLabCallback(req, res, code, gitlabConfig);
    return !!handled;
  } catch (error) {
    console.error(`[auth/callback] GitLab認証エラー:`, error);
    const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
    res.redirect(prefix +"/?error=gitlab_auth");
    return true;
  }
}

// helper: Hydra callback 専用ラッパー
async function _processHydraCallback(req, res, code, state) {
  try {
    const handled = await _handleHydraCallback(req, res, code, state);
    return !!handled;
  } catch (e) {
    console.error('[auth/_processHydraCallback] エラー:', e);
    return false;
  }
}

// Hydra認証コールバック専用
router.get("/hydra/callback", passport.authenticate("hydra", {
  failureRedirect: (global?.config?.rootPrefix || '/')+"/?error=hydra_auth"
}), (req, res) => {
  console.log(`[auth/hydra/callback] Hydra認証成功`);
  console.log(`[auth/hydra/callback] ユーザー情報:`, req.user);
  
  // セッションにユーザー情報を保存
  req.session.user = req.user.profile;
  req.session.accessToken = req.user.accessToken;
  req.session.idToken = req.user.idToken;
  req.session.isAuthenticated = true;
  //rootPrefixをredirect先に設定
  const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
  res.redirect(prefix + "/");
});

// ログアウト
router.get("/logout", (req, res) => {
  // カスタム認証セッションをクリア
  if (req.session) {
    req.session.isAuthenticated = false;
    req.session.user = null;
    req.session.accessToken = null;
  }
  
  // Passport認証をログアウト
  req.logout(() => {
    //rootPrefixをredirect先に設定
    const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
    res.redirect(prefix + "/");
  });
});

// ログイン状態確認API
router.get("/status", (req, res) => {
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  console.log(fqdn, global.authList);

  const currentAuthConfig = _resolveAuthConfigForFqdn(fqdn);
  if (currentAuthConfig.noAuthRequired) return res.json(_guestAuthResponse(currentAuthConfig));

  const user = _determineCurrentUser(req);
  const userInfo = normalizeUser(user);
  const email = userInfo.email || (userInfo.username ? userInfo.username + '@example.com' : null);
  const permissions = email ? getUserPermissions(email) : null;

  if (email) return res.json({ authenticated: true, user: userInfo, provider: _guessProvider(user), authConfig: currentAuthConfig, permissions });
  return res.json({ authenticated: false, user: userInfo, provider: null, authConfig: currentAuthConfig, permissions: null });
});

function _resolveAuthConfigForFqdn(fqdn) {
  return global.authList[fqdn] || global.authList['default'] || {};
}

function _guestAuthResponse(currentAuthConfig) {
  return {
    authenticated: true,
    user: { email: null, username: 'guest', displayName: 'ゲスト', avatar: null },
    provider: 'none',
    authConfig: currentAuthConfig,
    permissions: { level: 'full', description: 'フルアクセス（認証なしモード）', canView: true, canDownload: true, canUpload: true, canDelete: true }
  };
}

function _determineCurrentUser(req) {
  if (req.session?.isAuthenticated && req.session?.user) return req.session.user;
  if (req.isAuthenticated && req.isAuthenticated()) return req.user;
  return null;
}

function _guessProvider(user) {
  return user && user.provider ? user.provider : (user && user.profile ? 'hydra' : 'gitlab');
}

// 認証設定取得API
// 認証プロバイダー詳細設定を返すAPI
router.get('/config', (req, res) => {
  // global.authConfigはindex.jsでJSONから初期化済み
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const ret = global.authList[fqdn] || global.authList["default"] || {};
  console.log(`[auth/config] FQDN=${fqdn} の認証設定:`, ret);
  res.json(ret);
});

// デバッグ用セッション情報API
router.get("/debug", (req, res) => {
  res.json({
    sessionID: req.session?.id,
    sessionExists: !!req.session,
    sessionKeys: Object.keys(req.session || {}),
    oauth2States: req.session?.oauth2States,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
  user: req.user || null  });
});

export default router;

// GitLab コールバック処理を分離
async function _handleGitLabCallback(req, res, code, gitlabConfig) {
  try {
    console.log(`[auth/callback] GitLab認証コード検出: ${code.substring(0, 10)}...`);
    const tokenData = await getGitLabToken({
      code,
      clientId: gitlabConfig.GITLAB_CLIENT_ID,
      clientSecret: gitlabConfig.GITLAB_CLIENT_SECRET,
      callbackUrl: gitlabConfig.GITLAB_CALLBACK_URL,
      req
    });
    console.log(`[auth/callback] 取得access_token: ${tokenData.access_token ? tokenData.access_token.substring(0, 10) + '...' : 'undefined'}`);
    const userData = await getGitLabUserInfo(req, tokenData.access_token);
    console.log(`[auth/callback] GitLabユーザー情報取得成功: ${userData.name}`);

    req.session.user = userData;
    req.session.accessToken = tokenData.access_token;
    req.session.isAuthenticated = true;

    console.log(`[auth/callback] GitLab認証成功、トップページにリダイレクト`);
    const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
    res.redirect(prefix + "/");
    return true;
  } catch (err) {
    console.error('[auth/_handleGitLabCallback] エラー:', err);
    return false;
  }
}

// Hydra コールバック処理を分離
async function _handleHydraCallback(req, res, code, state) {
  // 分割されたヘルパーで処理を簡潔化
  try {
    console.log(`[auth/callback] Hydra認証コード検出: ${code.substring(0, 10)}...`);

    if (state) console.log(`[auth/callback] stateパラメータ: ${state}`);

    const hydraConfig = _resolveHydraConfig(req);
    if (!hydraConfig) {
      const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
      console.error(`[auth/callback] FQDN=${fqdn} のHydra認証設定が見つかりません`);
      const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
      res.redirect(prefix + "/?error=hydra_config");
      return true;
    }

    const tokenData = await _exchangeHydraToken(req, code, hydraConfig, state);
    const userData = await _fetchHydraUserInfo(tokenData);
    const profileUser = _buildHydraProfile(userData, tokenData);
    _saveHydraSession(req, profileUser, tokenData, hydraConfig);

    const prefix = (global?.config?.rootPrefix || '/').replace(/\/+$/, '');
    res.redirect(prefix + "/");
    return true;
  } catch (error) {
    console.error(`[auth/callback] Hydra認証エラー:`, error);
    return false;
  }
}

// helper: hydra 設定を解決
function _resolveHydraConfig(req) {
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  let hydraConfig = req.session?.hydraAuthConfig;
  if (!hydraConfig) hydraConfig = getAuthProviderConfig(fqdn, 'hydra');
  return hydraConfig || null;
}

// helper: トークンエクスチェンジ
async function _exchangeHydraToken(req, code, hydraConfig, state) {
  return getHydraToken({
    req,
    code,
    clientId: hydraConfig.HYDRA_CLIENT_ID,
    clientSecret: hydraConfig.HYDRA_CLIENT_SECRET,
    callbackUrl: hydraConfig.HYDRA_CALLBACK_URL,
    state
  });
}

// helper: ユーザー情報取得
async function _fetchHydraUserInfo(tokenData) {
  return getHydraUserInfo(tokenData.access_token);
}

// helper: profile を作成
function _buildHydraProfile(userData, tokenData) {
  return {
    profile: userData,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    idToken: tokenData.id_token
  };
}

// helper: セッションに保存
function _saveHydraSession(req, profileUser, tokenData, hydraConfig) {
  req.session.user = profileUser;
  req.session.accessToken = tokenData.access_token;
  req.session.refreshToken = tokenData.refresh_token;
  req.session.idToken = tokenData.id_token;
  req.session.isAuthenticated = true;
  req.session.hydraAuthConfig = hydraConfig;
  req.user = profileUser;
}
