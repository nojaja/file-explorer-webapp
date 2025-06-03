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
  console.log('[auth/gitlab] 認証開始:', {
    sessionID: req.session?.id,
    sessionExists: !!req.session,
    sessionKeys: Object.keys(req.session || {}),
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    url: req.url,
    headers: req.headers
  });
  
  // セッションを初期化（必要な場合）
  if (!req.session) {
    console.error('[auth/gitlab] セッションが存在しません');
    return res.status(500).send('セッション初期化エラー');
  }
  
  // passport-oauth2が期待する形式でsessionにoauth2オブジェクトを初期化
  if (!req.session.oauth2) {
    req.session.oauth2 = {};
  }
  
  // GitLab URL情報をログ出力（デバッグ用）
  console.log('[auth/gitlab] GitLab URL設定:', {
    GITLAB_URL_INTERNAL: global.authConfig.gitlab.GITLAB_URL_INTERNAL,
    GITLAB_URL: global.authConfig.gitlab.GITLAB_URL
  });
  
  // GitLab URL情報をセッションに保存（URL置換処理用）
  req.session.gitlabUrls = {
    gitlabInternalUrl: global.authConfig.gitlab.GITLAB_URL_INTERNAL,
    gitlabBrowserUrl: global.authConfig.gitlab.GITLAB_URL
  };
  console.log('[auth/gitlab] セッションにGitLab URL情報を保存:', req.session.gitlabUrls);
  
  passport.authenticate("gitlab", {
    scope: ['read_user']
  })(req, res, next);
});

// hydra認証開始
router.get("/hydra", (req, res, next) => {
  console.log('[auth/hydra] 認証開始:', {
    sessionID: req.session?.id,
    sessionExists: !!req.session,
    sessionKeys: Object.keys(req.session || {}),
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    url: req.url,
    headers: req.headers
  });
  
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
  console.log(`[auth/login] login_challenge受信: ${loginChallenge}`);
  
  if (!loginChallenge) {
    return res.status(400).send("login_challenge parameter is required");
  }

  try {
    // 簡易実装: 自動的にログインを受け入れる
    // 実際の実装では、ここでユーザー認証を行う
    const acceptData = await acceptLoginChallenge(loginChallenge, 'test-user');
    console.log(`[auth/login] login受け入れ完了、リダイレクト先: ${acceptData.redirect_to}`);
    console.log(`[auth/login] acceptData:`, JSON.stringify(acceptData, null, 2));
    
    return res.redirect(acceptData.redirect_to);
  } catch (error) {
    console.error(`[auth/login] エラー:`, error);
    return res.status(500).send(`Login error: ${error.message}`);
  }
});

// Hydra consent challenge handler  
router.get("/consent", async (req, res) => {
  const consentChallenge = req.query.consent_challenge;
  console.log(`[auth/consent] consent_challenge受信: ${consentChallenge}`);
  
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
    console.log(`[auth/consent] consent受け入れ完了、リダイレクト先: ${acceptData.redirect_to}`);
    console.log(`[auth/consent] acceptData:`, JSON.stringify(acceptData, null, 2));
        
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
      console.log(userData)
      
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
    }
  }

  // Hydra認証（Passport使用 - フォールバック）
  passport.authenticate(["hydra"], {
    failureRedirect: "/?error=auth"
  })(req, res, (err) => {
    if (err) {
      console.error(`[auth/callback] 認証エラー:`, err);
      console.error(`[auth/callback] エラー詳細:`, {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      return res.redirect("/?error=auth_callback");
    }
    console.log(`[auth/callback] 認証成功`);
    console.log(`[auth/callback] ユーザー情報:`, req.user);
    res.redirect("/");
  });
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
  // グローバルスコープから認証設定を参照
  
  // 認証なしモードの場合
  if (global.authList.noAuthRequired) {
    return res.json({ 
      authenticated: true, 
      name: "ゲスト", 
      provider: 'none',
      authConfig: global.authList
    });
  }
    // カスタム認証処理でログインした場合のチェック
  if (req.session?.isAuthenticated && req.session?.user) {
    const user = req.session.user;
    
    // カスタムHydra認証によるユーザー情報の場合（profile構造を持つ）
    if (req.session.idToken && user.profile) {
      return res.json({ 
        authenticated: true, 
        name: user.profile.name || user.profile.preferred_username || "ログイン中",
        provider: 'hydra',
        email: user.profile.email || 'testuser@example.com',
        custom: true,
        authConfig: global.authList
      });
    }
    // カスタムHydra認証によるユーザー情報の場合（直接構造）
    if (req.session.idToken) {
      return res.json({ 
        authenticated: true, 
        name: user.name || "ログイン中",
        provider: 'hydra',
        email: user.email || 'testuser@example.com',
        custom: true,
        authConfig: global.authList
      });
    }
      // カスタムGitLab認証によるユーザー情報の場合
    return res.json({ 
      authenticated: true, 
      name: user.name || user.username || "ログイン中",
      provider: 'gitlab',
      avatar: user.avatar_url,
      custom: true,
      authConfig: global.authList
    });
  }
  
  // 通常のPassport認証チェック
  if (req.isAuthenticated && req.isAuthenticated()) {
    // passport-github2/gitlab2はprofile.displayName, hydraはprofile等
    const user = req.user || {};    // GitLabの場合
    if (user._json && user._json.name) {
      return res.json({ 
        authenticated: true, 
        name: user._json.name || user.username,
        provider: 'gitlab',
        avatar: user._json.avatar_url,
        authConfig: global.authList
      });
    }
      // Hydraの場合
    if (user.profile) {
      return res.json({
        authenticated: true,
        name: user.profile?.name || user.profile?.preferred_username || "ログイン中",
        provider: 'hydra',
        email: user.profile?.email || 'testuser@example.com',
        authConfig: global.authList
      });
    }
    
    // GitHub/その他の場合
    let name = user.displayName || user.username || "ログイン中";
    let provider = user.provider || 'unknown';
    res.json({ 
      authenticated: true, 
      name,      provider,
      authConfig: global.authList
    });
  } else {
    res.json({ 
      authenticated: false,
      authConfig: global.authList
    });
  }
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

// 認証ステータス確認 + 権限情報取得
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const permissions = getUserPermissions(userEmail);
    
    res.json({
      authenticated: true,
      user: {
        email: userEmail,
        name: req.user?.name || req.user?.preferred_username,
        id: req.user?.id || req.user?.sub
      },
      permissions: permissions,
      authMethod: req.user?.authMethod || 'unknown'
    });
  } catch (error) {
    console.error('[auth/status] エラー:', error);
    res.status(500).json({ error: 'ステータス取得エラー' });
  }
});

export default router;
