import express from "express";
import passport from "passport";
import fetch from "node-fetch";

const router = express.Router();

// Github認証開始
router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));
// Gitlab認証開始
router.get("/gitlab", passport.authenticate("gitlab", { scope: ["read_user"] }));
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
router.get("/callback", (req, res, next) => {
  console.log(`[auth/callback] コールバック受信`);
  console.log(`[auth/callback] セッションID: ${req.session?.id}`);
  console.log(`[auth/callback] クエリパラメータ:`, req.query);
  console.log(`[auth/callback] OAuth2States:`, req.session?.oauth2States);
  
  // stateパラメータの存在確認
  const state = req.query.state;
  if (state) {
    console.log(`[auth/callback] stateパラメータ: ${state}`);
  } else {
    console.warn(`[auth/callback] stateパラメータがありません`);
  }
  
  passport.authenticate(["hydra", "github", "gitlab"], {
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
  req.logout(() => {
    res.redirect("/");
  });
});

// ログイン状態確認API
router.get("/status", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    // passport-github2/gitlab2はprofile.displayName, hydraはprofile等
    const user = req.user || {};
    let name = user.displayName || user.username || user.profile?.name || user.profile?.preferred_username || "ログイン中";
    res.json({ authenticated: true, name });
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

export default router;
