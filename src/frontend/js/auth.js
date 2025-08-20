import { renderTemplate } from './handlebars-utils.js';

/**
 * 認証管理クラス
 */
export class AuthManager {
  constructor() {
    // シングルトン: 既にインスタンスがあればそれを返す
    if (AuthManager._instance) return AuthManager._instance;
    this.authConfig = null;
    this.isAuthenticated = false;
    this.currentUser = null;
    // シングルトン登録
    AuthManager._instance = this;
  }
  /**
   * シングルトン取得
   * @returns {FileManager}
   */
  static getInstance() {
    return AuthManager._instance || new AuthManager();
  }
  /**
   * 認証設定の読み込み
   */
  async loadAuthConfig() {
    try {
      // WEB_ROOT_PATH対応: 相対パスでAPIリクエスト
      const res = await fetch('./auth/config');
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
      const res = await fetch('./auth/status');
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
    
    const templateData = {
      authenticated: true,
      userName,
      providerName,
      providerLabel
    };
    
    try {
      const html = await renderTemplate('auth-status', templateData);
      sidebarAuth.innerHTML = html;
      
      // ログアウトボタンのイベントリスナーを追加
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.onclick = async () => {
          await fetch('./auth/logout');
          location.reload();
        };
      }
    } catch (error) {
      console.error('認証状態テンプレートレンダリングエラー:', error);
      const html = await renderTemplate('error', { message: '認証状態の表示でエラーが発生しました' });
      sidebarAuth.innerHTML = html;
    }
  }

  /**
   * 未認証状態の描画
   */
  async renderUnauthenticatedState(sidebarAuth, loginStatusSpan) {
    // ログインボタンを認証方式ごとに動的生成
    const loginButtons = [];
    
    if (this.authConfig?.gitlab) {
      loginButtons.push({
        id: 'login-gitlab-btn',
        text: 'GitLabでログイン',
        href: './auth/gitlab'
      });
    }
    
    if (this.authConfig?.hydra) {
      loginButtons.push({
        id: 'hydra-login-btn',
        text: 'Hydraでログイン',
        href: './auth/hydra'
      });
    }
    
    if (this.authConfig?.github) {
      loginButtons.push({
        id: 'login-github-btn',
        text: 'GitHubでログイン',
        href: './auth/github'
      });
    }
    
    const templateData = {
      authenticated: false,
      loginButtons
    };
    
    try {
      const html = await renderTemplate('auth-status', templateData);
      sidebarAuth.innerHTML = html;
      
      // ログインボタンのイベントリスナーを追加
      loginButtons.forEach(button => {
        const btn = document.getElementById(button.id);
        if (btn) {
          btn.onclick = () => { window.location.href = button.href; };
        }
      });
    } catch (error) {
      console.error('未認証状態テンプレートレンダリングエラー:', error);
      const html = await renderTemplate('error', { message: '認証状態の表示でエラーが発生しました' });
      sidebarAuth.innerHTML = html;
    }
  }

  /**
   * ログアウト処理
   */
  async logout() {
    try {
      await fetch('./auth/logout');
      location.reload();
    } catch (error) {
      console.error('[AuthManager] ログアウトエラー:', error);
      location.reload(); // エラーでもリロード
    }
  }
}
