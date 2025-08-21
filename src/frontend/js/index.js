import router from './router.js';
import { AuthManager } from './auth.js';
import { FileManager } from './file.js';

/**
 * アプリケーションのメインエントリーポイント
 */
class App {
  constructor() {
    this.authManager = AuthManager.getInstance();
    this.fileManager = FileManager.getInstance();
    this.init();
  }

  async init() {
    try {
      console.log('[App] アプリケーション初期化開始');
      
      // 1. 認証設定の読み込み
      await this.authManager.loadAuthConfig();
      
      // 2. SPAルーティングの開始（メインページ描画）
      await router.pageGen('main');
      
      // 3. 認証状態の更新
      await this.authManager.updateLoginStatus();
      
      // 4. ROOT_PATH情報の取得（認証済みの場合）
      if (this.authManager.isAuthenticated) {
        await this.fileManager.fetchRootPaths();
        
        // 5. 初期ファイル一覧の取得
        await this.fileManager.fetchFiles('');
      }
      
      // 6. UIイベントリスナーの設定
      this.setupEventListeners();
      
      console.log('[App] アプリケーション初期化完了');
      
    } catch (error) {
      console.error('[App] 初期化エラー:', error);
      await router.handleError(error);
    }
  }

  /**
   * UIイベントリスナーの設定
   */
  setupEventListeners() {
    // ファイルツールバーのボタンイベント
    const parentBtn = document.getElementById('parent-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (parentBtn) {
      parentBtn.onclick = () => {
        if (!this.fileManager.uiState.currentPath) return;
        const parts = this.fileManager.uiState.currentPath.split('/').filter(Boolean);
        if (parts.length === 0) return;
        parts.pop();
        const parentPath = parts.join('/');
        this.fileManager.changeDir(parentPath);
      };
    }
    
    if (refreshBtn) {
      refreshBtn.onclick = () => this.fileManager.fetchFiles(this.fileManager.uiState.currentPath);
    }

    // ファイルアップロード関連のイベント
    this.setupUploadEvents();
  }

  /**
   * ファイルアップロード関連のイベント設定
   */
  setupUploadEvents() {
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileTable = document.getElementById('file-table');

    if (uploadBtn && fileInput) {
      uploadBtn.onclick = () => fileInput.click();
    }
    
    if (fileInput) {
      fileInput.onchange = () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.fileManager.handleUpload(fileInput.files);
          fileInput.value = '';
        }
      };
    }
    
    if (fileTable) {
      fileTable.addEventListener('dragover', (evt) => {
        evt.preventDefault();
        fileTable.classList.add('dragover-upload');
      });
      
      fileTable.addEventListener('dragleave', (evt) => {
        evt.preventDefault();
        if (!fileTable.contains(evt.relatedTarget)) {
          fileTable.classList.remove('dragover-upload');
        }
      });
      
      fileTable.addEventListener('drop', (evt) => {
        evt.preventDefault();
        fileTable.classList.remove('dragover-upload');
        if (evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
          this.fileManager.handleUpload(evt.dataTransfer.files);
        }
      });
    }
  }
}

// アプリケーション開始
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

// グローバル関数の公開（HTMLからの呼び出し用）
import { exportGlobalFunctions } from './global.js';
exportGlobalFunctions();
