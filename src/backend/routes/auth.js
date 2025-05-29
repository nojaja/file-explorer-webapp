import express from "express";
import passport from "passport";
import fetch from "node-fetch";
import { getGitLabToken } from "../util/gitlabTokenHelper.js";

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
    GITLAB_URL_INTERNAL: process.env.GITLAB_URL_INTERNAL,
    GITLAB_URL: process.env.GITLAB_URL
  });
  
  // GitLab URL情報をセッションに保存（URL置換処理用）
  req.session.gitlabUrls = {
    internalUrl: process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929',
    browserUrl: process.env.GITLAB_URL || 'http://localhost:8929'
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
    const hydraAdminUrl = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';
    
    // login challengeを受け入れる
    const acceptResponse = await fetch(`${hydraAdminUrl}/admin/oauth2/auth/requests/login/accept?login_challenge=${loginChallenge}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'test-user', // テストユーザー
        remember: false,
        remember_for: 0,
        acr: '1'
      })
    });

    if (!acceptResponse.ok) {
      throw new Error(`Failed to accept login: ${acceptResponse.status}`);
    }    const acceptData = await acceptResponse.json();
    console.log(`[auth/login] login受け入れ完了、リダイレクト先: ${acceptData.redirect_to}`);
    console.log(`[auth/login] acceptData:`, JSON.stringify(acceptData, null, 2));
    
    // Docker内部URLをブラウザアクセス可能なURLに変換
    const redirectUrl = acceptData.redirect_to.replace('http://hydra:4444', 'http://localhost:4444');
    console.log(`[auth/login] 修正後リダイレクト先: ${redirectUrl}`);
    console.log(`[auth/login] URL変換前: ${acceptData.redirect_to}`);
    console.log(`[auth/login] URL変換後: ${redirectUrl}`);
    
    return res.redirect(redirectUrl);
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
    const hydraAdminUrl = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';
    
    // consent challengeを受け入れる
    const acceptResponse = await fetch(`${hydraAdminUrl}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${consentChallenge}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_scope: ['openid', 'profile', 'email'],
        grant_access_token_audience: [],
        remember: false,
        remember_for: 0,
        session: {
          id_token: {
            'name': 'test-user'
          }
        }
      })
    });

    if (!acceptResponse.ok) {
      throw new Error(`Failed to accept consent: ${acceptResponse.status}`);
    }    const acceptData = await acceptResponse.json();
    console.log(`[auth/consent] consent受け入れ完了、リダイレクト先: ${acceptData.redirect_to}`);
    console.log(`[auth/consent] acceptData:`, JSON.stringify(acceptData, null, 2));
    
    // Docker内部URLをブラウザアクセス可能なURLに変更
    const redirectUrl = acceptData.redirect_to.replace('http://hydra:4444', 'http://localhost:4444');
    console.log(`[auth/consent] 修正後リダイレクト先: ${redirectUrl}`);
    console.log(`[auth/consent] URL変換前: ${acceptData.redirect_to}`);
    console.log(`[auth/consent] URL変換後: ${redirectUrl}`);
    
    return res.redirect(redirectUrl);
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
  
  // GitLab認証コードの確認
  const code = req.query.code;
  const isGitLabCallback = req.session?.gitlabUrls && code;

  // GitLab認証の場合、カスタム処理
  if (isGitLabCallback) {
    try {
      console.log(`[auth/callback] GitLab認証コード検出: ${code.substring(0, 10)}...`);
      
      // GitLabトークンを取得
      const tokenData = await getGitLabToken(
        code,
        process.env.GITLAB_CLIENT_ID,
        process.env.GITLAB_CLIENT_SECRET,
        process.env.OAUTH_CALLBACK_URL
      );
      
      // GitLabユーザー情報を取得
      const gitlabUrl = process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929';
      const userResponse = await fetch(`${gitlabUrl}/api/v4/user`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error(`GitLabユーザー情報取得失敗: ${userResponse.status}`);
      }
      
      const userData = await userResponse.json();
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
  
  // stateパラメータの存在確認
  const state = req.query.state;
  if (state) {
    console.log(`[auth/callback] stateパラメータ: ${state}`);
  } else {
    console.warn(`[auth/callback] stateパラメータがありません`);
  }
  
  // GitLab URLの置換処理
  // GitLabからのリダイレクトURLに含まれるコンテナ名を修正
  const originalUrl = req.originalUrl;
  const queryString = req.url.split('?')[1] || '';
  const queryParams = new URLSearchParams(queryString);
  
  // リダイレクトURLがクエリパラメータに含まれている場合の処理
  for (const [key, value] of queryParams.entries()) {
    if (value.includes('gitlab:8929')) {
      console.log(`[auth/callback] ${key}パラメータにGitLab内部URLを検出: ${value}`);
      const correctedValue = value.replace(/gitlab:8929/g, 'localhost:8929');
      queryParams.set(key, correctedValue);
      console.log(`[auth/callback] 修正後${key}パラメータ: ${correctedValue}`);
      
      // 修正したクエリパラメータでリダイレクト
      const newUrl = `${req.path}?${queryParams.toString()}`;
      console.log(`[auth/callback] 修正後URL: ${newUrl}`);
      return res.redirect(newUrl);
    }
  }
  
  // URLそのものにコンテナ名が含まれている場合の処理
  if (originalUrl && originalUrl.includes('gitlab:8929')) {
    console.log(`[auth/callback] GitLab内部URLを検出: ${originalUrl}`);
    const correctedUrl = originalUrl.replace(/gitlab:8929/g, 'localhost:8929');
    console.log(`[auth/callback] 修正後URL: ${correctedUrl}`);
    return res.redirect(correctedUrl);
  }
  
  // Hydra認証（デフォルト）
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
  // カスタム認証処理でログインした場合のチェック
  if (req.session?.isAuthenticated && req.session?.user) {
    const user = req.session.user;
    return res.json({ 
      authenticated: true, 
      name: user.name || user.username || "ログイン中",
      provider: 'gitlab',
      avatar: user.avatar_url,
      custom: true
    });
  }
  
  // 通常のPassport認証チェック
  if (req.isAuthenticated && req.isAuthenticated()) {
    // passport-github2/gitlab2はprofile.displayName, hydraはprofile等
    const user = req.user || {};
    
    // GitLabの場合
    if (user._json && user._json.name) {
      return res.json({ 
        authenticated: true, 
        name: user._json.name || user.username,
        provider: 'gitlab',
        avatar: user._json.avatar_url
      });
    }
    
    // Hydraの場合
    if (user.profile) {
      return res.json({
        authenticated: true,
        name: user.profile?.name || user.profile?.preferred_username || "ログイン中",
        provider: 'hydra'
      });
    }
    
    // GitHub/その他の場合
    let name = user.displayName || user.username || "ログイン中";
    let provider = user.provider || 'unknown';
    res.json({ authenticated: true, name, provider });
  } else {
    res.json({ authenticated: false });
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
    user: req.user || null
  });
});

// GitLabのURLを変換する関数（内部URL→ブラウザURL）
function convertGitlabUrlForBrowser(url) {
  if (!url || typeof url !== 'string') return url;
  
  const gitlabInternalUrl = process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929';
  const gitlabBrowserUrl = process.env.GITLAB_URL || 'http://localhost:8929';
  
  if (url.includes(gitlabInternalUrl)) {
    console.log(`[gitlab] URLの変換: ${url} → ${url.replace(gitlabInternalUrl, gitlabBrowserUrl)}`);
    return url.replace(gitlabInternalUrl, gitlabBrowserUrl);
  }
  
  return url;
}

// GitLabユーザー情報取得
async function fetchGitLabUserInfo(accessToken) {
  try {
    // サーバー間通信にはGITLAB_URLを使用
    const gitlabUrl = process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929';
    const userResponse = await fetch(`${gitlabUrl}/api/v4/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!userResponse.ok) {
      console.error(`[gitlab] ユーザー情報取得エラー: ${userResponse.status}`);
      return null;
    }
    
    const userData = await userResponse.json();
    console.log('[gitlab] ユーザー情報取得成功:', {
      id: userData.id,
      username: userData.username,
      name: userData.name,
      email: userData.email
    });
    
    return userData;
  } catch (error) {
    console.error('[gitlab] ユーザー情報取得例外:', error);
    return null;
  }
}

export default router;
