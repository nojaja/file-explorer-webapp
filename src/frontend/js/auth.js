/**
 * 認証管理クラス
 */
export class AuthManager {
  constructor() {
    this.authConfig = null;
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  /**
   * 認証設定の読み込み
   */
  async loadAuthConfig() {
    try {
      const res = await fetch('/auth/config');
      this.authConfig = await res.json();
      console.log('[AuthManager] authConfig loaded:', this.authConfig);
      
      // グローバルに設定（既存コードとの互換性）
      window.authConfig = this.authConfig;
      
    } catch (e) {
      console.error('[AuthManager] authConfig取得失敗:', e);
      this.authConfig = null;
      window.authConfig = null;
    }
  }

  /**
   * 認証状態の更新
   */
  async updateLoginStatus() {
    try {
      const loginStatusSpan = document.getElementById('login-status-span');
      const sidebarAuth = document.getElementById('sidebar-auth');
      
      if (!sidebarAuth) {
        console.warn('[AuthManager] sidebarAuth not found. ステータス表示をスキップ');
        return;
      }

      // 認証状態取得
      const res = await fetch('/auth/status');
      const data = await res.json();
      
      sidebarAuth.innerHTML = '';
      
      if (data.authenticated) {
        this.isAuthenticated = true;
        this.currentUser = data.user;
        
        await this.renderAuthenticatedState(sidebarAuth, data);
        
        // メインコンテンツの表示
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.style.display = '';
        
        window.isAuthenticated = true;
        
      } else {
        this.isAuthenticated = false;
        this.currentUser = null;
        
        await this.renderUnauthenticatedState(sidebarAuth, loginStatusSpan);
        
        // メインコンテンツの非表示
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.style.display = 'none';
        
        window.isAuthenticated = false;
      }
      
    } catch (e) {
      console.error('[AuthManager] 認証状態取得エラー:', e);
      this.isAuthenticated = false;
      window.isAuthenticated = false;
      
      const loginStatusSpan = document.getElementById('login-status-span');
      if (loginStatusSpan) loginStatusSpan.textContent = '認証状態取得失敗';
      
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.style.display = 'none';
    }
  }

  /**
   * 認証済み状態の描画
   */
  async renderAuthenticatedState(sidebarAuth, data) {
    // プロバイダーバッジを追加
    const providerName = data.provider || 'unknown';
    const providerLabel = {
      'github': 'GitHub',
      'gitlab': 'GitLab',
      'hydra': 'Hydra',
      'none': '認証なし',
      'unknown': 'OAuth'
    }[providerName] || 'OAuth';
    
    // ユーザー名取得（displayName優先、なければusername）
    const userName = (data.user && (data.user.displayName || data.user.username)) 
      ? (data.user.displayName || data.user.username) 
      : '';
      
    let loginStatusHtml = `
      ログイン中: <span style="font-weight:bold;">${userName}</span>
      <span class="badge ${providerName}">${providerLabel}</span>
    `;
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'login-status-span';
    statusDiv.innerHTML = loginStatusHtml;
    sidebarAuth.appendChild(statusDiv);
    
    // ログアウトボタン
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.textContent = 'ログアウト';
    logoutBtn.className = 'sidebar-btn logout';
    logoutBtn.onclick = async () => {
      await fetch('/auth/logout');
      location.reload();
    };
    sidebarAuth.appendChild(logoutBtn);
  }

  /**
   * 未認証状態の描画
   */
  async renderUnauthenticatedState(sidebarAuth, loginStatusSpan) {
    if (loginStatusSpan) {
      loginStatusSpan.innerHTML = '<span style="color:#d32f2f;font-weight:bold;">未ログインです。ログインしてください。</span>';
    }
    
    // ログインボタンを認証方式ごとに動的生成
    if (this.authConfig?.gitlab) {
      const gitlabBtn = document.createElement('button');
      gitlabBtn.id = 'login-gitlab-btn';
      gitlabBtn.className = 'login-btn';
      gitlabBtn.textContent = 'GitLabでログイン';
      gitlabBtn.onclick = () => { window.location.href = '/auth/gitlab'; };
      sidebarAuth.appendChild(gitlabBtn);
    }
    
    if (this.authConfig?.hydra) {
      const hydraBtn = document.createElement('button');
      hydraBtn.id = 'hydra-login-btn';
      hydraBtn.className = 'login-btn hydra';
      hydraBtn.textContent = 'Hydraでログイン';
      hydraBtn.onclick = () => { window.location.href = '/auth/hydra'; };
      sidebarAuth.appendChild(hydraBtn);
    }
    
    if (this.authConfig?.github) {
      const githubBtn = document.createElement('button');
      githubBtn.id = 'login-github-btn';
      githubBtn.className = 'login-btn';
      githubBtn.textContent = 'GitHubでログイン';
      githubBtn.onclick = () => { window.location.href = '/auth/github'; };
      sidebarAuth.appendChild(githubBtn);
    }
  }

  /**
   * ログアウト処理
   */
  async logout() {
    try {
      await fetch('/auth/logout');
      location.reload();
    } catch (error) {
      console.error('[AuthManager] ログアウトエラー:', error);
      location.reload(); // エラーでもリロード
    }
  }
}
