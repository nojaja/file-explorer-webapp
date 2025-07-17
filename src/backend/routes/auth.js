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
  console.log(`[auth/callback] コールバック受信`);
  console.log(`[auth/callback] セッションID: ${req.session?.id}`);
  console.log(`[auth/callback] クエリパラメータ:`, req.query);
  console.log(`[auth/callback] OAuth2States:`, req.session?.oauth2States);
    // 認可コードの確認
  const code = req.query.code;
  const state = req.query.state;
  const isGitLabCallback = req.session?.gitlabUrls && code;
  const isHydraCallback = code && !isGitLabCallback; // GitLabでなければHydraと判断

  // GitLab認証の場合、FQDNごとの設定を利用
  if (isGitLabCallback) {
    try {
      console.log(`[auth/callback] GitLab認証コード検出: ${code.substring(0, 10)}...`);
      // FQDNからGitLab認証設定を取得（セッション優先、なければFQDNから再取得）
      const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
      let gitlabConfig = req.session.gitlabAuthConfig;
      if (!gitlabConfig) {
        gitlabConfig = getAuthProviderConfig(fqdn, 'gitlab');
      }
      if (!gitlabConfig) {
        console.error(`[auth/callback] FQDN=${fqdn} のGitLab認証設定が見つかりません`);
        return res.redirect("/?error=gitlab_config");
      }
      // GitLabトークンを取得
      const tokenData = await getGitLabToken(
        code,
        gitlabConfig.GITLAB_CLIENT_ID,
        gitlabConfig.GITLAB_CLIENT_SECRET,
        gitlabConfig.GITLAB_CALLBACK_URL
      );
      // GitLabユーザー情報を取得
      const userData = await getGitLabUserInfo(tokenData.access_token);
      console.log(`[auth/callback] GitLabユーザー情報取得成功: ${userData.name}`);
      
      // セッションにユーザー情報を保存
      req.session.user = userData;
      req.session.accessToken = tokenData.access_token;
      req.session.isAuthenticated = true;
      
      // ログイン後のリダイレクト
      console.log(`[auth/callback] GitLab認証成功、トップページにリダイレクト`);
      return res.redirect('/');
    } catch (error) {
      console.error(`[auth/callback] GitLab認証エラー:`, error);
      return res.redirect("/?error=gitlab_auth");
    }
  }
  // Hydraコールバックで認可コードがある場合、手動でトークン取得を試みる
  else if (isHydraCallback) {
    try {
      console.log(`[auth/callback] Hydra認証コード検出: ${code.substring(0, 10)}...`);
      
      // stateパラメータの存在確認
      if (state) {
        console.log(`[auth/callback] stateパラメータ: ${state}`);
      } else {
        console.warn(`[auth/callback] stateパラメータがありません`);
      }
      // FQDNからHydra認証設定を取得（セッション優先、なければFQDNから再取得）
      const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
      let hydraConfig = req.session.hydraAuthConfig;
      if (!hydraConfig) {
        hydraConfig = getAuthProviderConfig(fqdn, 'hydra');
      }
      if (!hydraConfig) {
        console.error(`[auth/callback] FQDN=${fqdn} のHydra認証設定が見つかりません`);
        return res.redirect("/?error=hydra_config");
      }
      // Hydraトークンを手動取得
      const tokenData = await getHydraToken(
        req,
        code,
        hydraConfig.HYDRA_CLIENT_ID,
        hydraConfig.HYDRA_CLIENT_SECRET,
        hydraConfig.HYDRA_CALLBACK_URL,
        state
      );
      // ユーザー情報を取得
      const userData = await getHydraUserInfo(tokenData.access_token);
      console.log(`[auth/callback] Hydraユーザー情報取得成功:`, userData);
      
      // Passportスタイルのユーザーオブジェクトを作成
      const profileUser = {
        profile: userData,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token
      };
      // セッションにユーザー情報・設定を保存
      req.session.user = profileUser;
      req.session.accessToken = tokenData.access_token;
      req.session.refreshToken = tokenData.refresh_token;
      req.session.idToken = tokenData.id_token;
      req.session.isAuthenticated = true;
      req.session.hydraAuthConfig = hydraConfig;
      // req.userにも設定（Passportとの互換性）
      req.user = profileUser;
      
      // ログイン後のリダイレクト
      console.log(`[auth/callback] Hydra認証成功、トップページにリダイレクト`);
      console.log(`[auth/callback] 設定されたユーザー情報:`, profileUser);
      return res.redirect('/');
    } catch (error) {
      console.error(`[auth/callback] Hydra認証エラー:`, error);
      // エラーの場合、Passportのフローにフォールバック
      console.log(`[auth/callback] Passport認証にフォールバック`);
    }
  }

  // 通常のPassport認証フローにフォールバック
  next();
});

// Hydra認証コールバック専用
router.get("/hydra/callback", passport.authenticate("hydra", {
  failureRedirect: "/?error=hydra_auth"
}), (req, res) => {
  console.log(`[auth/hydra/callback] Hydra認証成功`);
  console.log(`[auth/hydra/callback] ユーザー情報:`, req.user);
  
  // セッションにユーザー情報を保存
  req.session.user = req.user.profile;
  req.session.accessToken = req.user.accessToken;
  req.session.idToken = req.user.idToken;
  req.session.isAuthenticated = true;
  
  res.redirect("/");
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
    res.redirect("/");
  });
});

// ログイン状態確認API
router.get("/status", (req, res) => {

  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  console.log(fqdn,global.authList);

  // 現在の認証設定を動的に取得
  const currentAuthConfig = global.authList[fqdn] || global.authList["default"] || {};
  console.log(`[auth/config] FQDN=${fqdn} の認証設定:`, currentAuthConfig);
  // 認証なしモードの場合
  if (currentAuthConfig.noAuthRequired) {
    return res.json({ 
      authenticated: true, 
      user: {
        email: null,
        username: 'guest',
        displayName: 'ゲスト',
        avatar: null
      },
      provider: 'none',
      authConfig: currentAuthConfig,
      permissions: {
        level: 'full',
        description: 'フルアクセス（認証なしモード）',
        canView: true,
        canDownload: true,
        canUpload: true,
        canDelete: true
      }
    });
  }

  // ユーザー情報の共通化関数
  function normalizeUser(u) {
    if (!u) return { email: null, username: null, displayName: null, avatar: null };
    // Hydra profile
    if (u.profile) {
      return {
        email: u.profile.email || null,
        username: u.profile.preferred_username || u.profile.name || null,
        displayName: u.profile.name || u.profile.preferred_username || null,
        avatar: u.profile.picture || null
      };
    }
    // GitLab _json
    if (u._json) {
      return {
        email: u._json.email || null,
        username: u._json.username || null,
        displayName: u._json.name || u._json.username || null,
        avatar: u._json.avatar_url || null
      };
    }
    // GitLab/カスタム
    return {
      email: u.email || null,
      username: u.username || u.name || null,
      displayName: u.name || u.username || null,
      avatar: u.avatar_url || null
    };
  }

  let user = null;
    // カスタム認証処理でログインした場合のチェック
  if (req.session?.isAuthenticated && req.session?.user) {
    user = req.session.user;
  } else if (req.isAuthenticated && req.isAuthenticated()) {
    user = req.user;
  }
  
  const userInfo = normalizeUser(user);
  const email = userInfo.email || (userInfo.username ? userInfo.username + '@example.com' : null);
  const permissions = email ? getUserPermissions(email) : null;

  if (email) {
      return res.json({ 
        authenticated: true, 
        user: userInfo,
        provider: user && user.provider ? user.provider : (user && user.profile ? 'hydra' : 'gitlab'),
        authConfig: currentAuthConfig,
        permissions
      });
  } else {
      return res.json({
        authenticated: false,
        user: userInfo,
        provider: null,
        authConfig: currentAuthConfig,
        permissions: null
    });
  }
});

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
