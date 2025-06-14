import express from "express";
import passport from "passport";
import { getGitLabToken, getGitLabUserInfo } from "../util/gitlabTokenHelper.js";
import { getHydraToken, getHydraUserInfo, acceptLoginChallenge, acceptConsentChallenge } from "../util/hydraTokenHelper.js";
import { getUserPermissions } from "../services/authorizationService.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Github認証開始
router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));
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
  
  // GitLab URL情報をセッションに保存（URL置換処理用）
  req.session.gitlabUrls = {
    gitlabInternalUrl: global.authConfig.gitlab.GITLAB_URL_INTERNAL,
    gitlabBrowserUrl: global.authConfig.gitlab.GITLAB_URL
  };
  
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
    const acceptData = await acceptLoginChallenge(loginChallenge, 'test-user');
    
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
    const acceptData = await acceptConsentChallenge(consentChallenge, ['openid', 'profile', 'email'], testUserInfo);
        
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
  
  // GitLab認証の場合、カスタム処理
  if (isGitLabCallback) {
    try {
      console.log(`[auth/callback] GitLab認証コード検出: ${code.substring(0, 10)}...`);
      
      // GitLabトークンを取得
      const tokenData = await getGitLabToken(
        code,
        global.authConfig.gitlab.GITLAB_CLIENT_ID,
        global.authConfig.gitlab.GITLAB_CLIENT_SECRET,
        global.authConfig.gitlab.OAUTH_CALLBACK_URL
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
      
      // Hydraトークンを手動取得
      const tokenData = await getHydraToken(
        code,
        global.authConfig.hydra.HYDRA_CLIENT_ID,
        global.authConfig.hydra.HYDRA_CLIENT_SECRET,
        global.authConfig.hydra.HYDRA_CALLBACK_URL,
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
      
      // セッションにユーザー情報を保存（Passportスタイル）
      req.session.user = profileUser;
      req.session.accessToken = tokenData.access_token;
      req.session.refreshToken = tokenData.refresh_token;
      req.session.idToken = tokenData.id_token;
      req.session.isAuthenticated = true;
      
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
    }  }

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
  // 現在の認証設定を動的に取得
  const currentAuthConfig = global.authList || {
    github: process.env.GITHUB === 'TRUE',
    gitlab: process.env.GITLAB === 'TRUE', 
    hydra: process.env.HYDRA === 'TRUE',
    noAuthRequired: !(process.env.GITHUB === 'TRUE' || process.env.GITLAB === 'TRUE' || process.env.HYDRA === 'TRUE')
  };
  
  // 認証なしモードの場合
  if (currentAuthConfig.noAuthRequired) {
    return res.json({ 
      authenticated: true, 
      name: "ゲスト", 
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
    // カスタム認証処理でログインした場合のチェック
  if (req.session?.isAuthenticated && req.session?.user) {
    const user = req.session.user;
      // カスタムHydra認証によるユーザー情報の場合（profile構造を持つ）
    if (req.session.idToken && user.profile) {
      const userEmail = user.profile.email || 'testuser@example.com';
      const permissions = getUserPermissions(userEmail);
      return res.json({ 
        authenticated: true, 
        name: user.profile.name || user.profile.preferred_username || "ログイン中",
        provider: 'hydra',
        email: userEmail,        custom: true,
        authConfig: currentAuthConfig,
        permissions: permissions
      });
    }
    // カスタムHydra認証によるユーザー情報の場合（直接構造）
    if (req.session.idToken) {
      const userEmail = user.email || 'testuser@example.com';
      const permissions = getUserPermissions(userEmail);
      return res.json({ 
        authenticated: true, 
        name: user.name || "ログイン中",
        provider: 'hydra',
        email: userEmail,
        custom: true,
        authConfig: currentAuthConfig,
        permissions: permissions
      });
    }
      // カスタムGitLab認証によるユーザー情報の場合
    const userEmail = user.email || user.name + '@example.com';
    const permissions = getUserPermissions(userEmail);
    return res.json({ 
      authenticated: true, 
      name: user.name || user.username || "ログイン中",
      provider: 'gitlab',
      avatar: user.avatar_url,
      custom: true,
      authConfig: currentAuthConfig,
      permissions: permissions
    });
  }
  
  // 通常のPassport認証チェック
  if (req.isAuthenticated && req.isAuthenticated()) {
    // passport-github2/gitlab2はprofile.displayName, hydraはprofile等
    const user = req.user || {};    // GitLabの場合
    if (user._json && user._json.name) {
      const userEmail = user._json.email || user.username + '@example.com';
      const permissions = getUserPermissions(userEmail);
      return res.json({ 
        authenticated: true, 
        name: user._json.name || user.username,
        provider: 'gitlab',
        avatar: user._json.avatar_url,
        authConfig: currentAuthConfig,
        permissions: permissions
      });
    }
      // Hydraの場合
    if (user.profile) {
      const userEmail = user.profile?.email || 'testuser@example.com';
      const permissions = getUserPermissions(userEmail);
      return res.json({
        authenticated: true,
        name: user.profile?.name || user.profile?.preferred_username || "ログイン中",
        provider: 'hydra',
        email: userEmail,
        authConfig: currentAuthConfig,
        permissions: permissions
      });
    }
    
    // GitHub/その他の場合
    let name = user.displayName || user.username || "ログイン中";
    let provider = user.provider || 'unknown';
    const userEmail = user.email || user.emails?.[0]?.value || name + '@example.com';
    const permissions = getUserPermissions(userEmail);
    res.json({ 
      authenticated: true, 
      name,      provider,
      authConfig: currentAuthConfig,
      permissions: permissions
    });    } else {
    console.log('[/status] 認証なしモードではない、通常の認証フローへ');
    res.json({ 
      authenticated: false,
      authConfig: currentAuthConfig,
      permissions: null
    });
  }
});

// 認証設定取得API
router.get('/config', (req, res) => {
  const currentAuthConfig = global.authList || {
    github: process.env.GITHUB === 'TRUE',
    gitlab: process.env.GITLAB === 'TRUE',
    hydra: process.env.HYDRA === 'TRUE',
    noAuthRequired: !(process.env.GITHUB === 'TRUE' || process.env.GITLAB === 'TRUE' || process.env.HYDRA === 'TRUE')
  };
  res.json(currentAuthConfig);
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
