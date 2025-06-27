import { renderTemplate } from './handlebars-utils.js';

// --- Functional Domain Modeling 型定義 ---
/** @typedef {string & { readonly brand: 'RootPathId' }} RootPathId */
/** @typedef {string & { readonly brand: 'RelPath' }} RelPath */
/**
 * ファイルエントリ型
 * @typedef {Object} FileEntry
 * @property {string} name
 * @property {'dir'|'file'} type
 * @property {number|undefined} size
 * @property {string} mtime
 * @property {string} path
 */
/**
 * ROOT_PATH型
 * @typedef {Object} RootPath
 * @property {RootPathId} id
 * @property {string} name
 * @property {string} path
 * @property {string} [description]
 * @property {string} [permission]
 */
/**
 * 権限型
 * @typedef {Object} Permission
 * @property {boolean} canView
 * @property {boolean} canDownload
 * @property {boolean} canUpload
 * @property {boolean} canDelete
 */
/**
 * UI状態型
 * @typedef {Object} UIState
 * @property {RootPath|null} selectedRootPath
 * @property {string} currentPath
 * @property {Permission|null} userPermissions
 * @property {RootPath[]} rootPaths
 */
/**
 * 成功/失敗を表すResult型
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: Error }} Result
 */

// --- スマートコンストラクタ: パス検証 ---
function createRelPath(path) {
  if (typeof path !== 'string') return { ok: false, error: new Error('パスが不正です') };
  if (path.includes('..')) return { ok: false, error: new Error('不正なパス') };
  return { ok: true, value: path };
}

/**
 * ファイル管理クラス
 */
export class FileManager {
  constructor() {
    // --- UI状態の初期化 ---
    /** @type {UIState} */
    this.uiState = {
      selectedRootPath: null,
      currentPath: '',
      userPermissions: null,
      rootPaths: [] // ROOT_PATH一覧を追加
    };
    
    this.rootPaths = []; // 利用可能なROOT_PATH一覧
    
    // グローバル変数との互換性
    window.uiState = this.uiState;
    window.rootPaths = this.rootPaths;
  }

  /**
   * 指定ROOT_PATHのユーザー権限を取得
   * @param {string} rootPathId
   * @returns {Promise<Object>} 権限オブジェクト
   */
  async fetchUserPermissionsForRootPath(rootPathId) {
    if (!rootPathId) return null;
    
    try {
      const url = `/api/permissions?rootPathId=${encodeURIComponent(rootPathId)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('権限情報の取得に失敗しました');
      const data = await res.json();
      return data.permissions;
    } catch (error) {
      console.error('[FileManager] 権限取得エラー:', error);
      return null;
    }
  }

  /**
   * ROOT_PATH一覧を取得
   */
  async fetchRootPaths() {
    try {
      const res = await fetch('/api/rootpaths', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          console.log('[FileManager] 認証が必要です');
          return;
        }
        throw new Error('ROOT_PATH一覧取得に失敗しました');
      }
      
      const data = await res.json();
      this.rootPaths = data.rootPaths || [];
      this.uiState.rootPaths = data.rootPaths || []; // uiStateにも保存
      window.rootPaths = this.rootPaths;
      
      // デフォルトROOT_PATHを設定
      if (this.rootPaths.length > 0 && !this.uiState.selectedRootPath) {
        const defaultRootPath = data.defaultRootPath || this.rootPaths[0];
        this.uiState.selectedRootPath = defaultRootPath;
        window.uiState.selectedRootPath = defaultRootPath;
      }
      
      console.log('[FileManager] ROOT_PATH一覧取得完了:', this.rootPaths);
      await this.renderRootPathList();
      
    } catch (e) {
      console.error('[FileManager] ROOT_PATH取得エラー:', e);
      // ROOT_PATH取得エラーの場合は非表示にする
    }
  }

  /**
   * ROOT_PATHを選択
   * @param {string} rootPathId 
   */
  async selectRootPath(rootPathId) {
    try {
      const res = await fetch('/api/rootpaths/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rootPathId }),
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('ROOT_PATH選択に失敗しました');
      
      const data = await res.json();
      this.uiState.selectedRootPath = data.selectedRootPath;
      window.uiState.selectedRootPath = data.selectedRootPath;
      
      // ROOT_PATHデータの状態保持
      if (!this.uiState.rootPaths || this.uiState.rootPaths.length === 0) {
        if (this.rootPaths && this.rootPaths.length > 0) {
          this.uiState.rootPaths = this.rootPaths;
        } else {
          await this.fetchRootPaths();
        }
      }
      
      console.log('[FileManager] ROOT_PATH選択完了:', this.uiState.selectedRootPath);
      
      // 権限を取得し直す
      this.uiState.userPermissions = await this.fetchUserPermissionsForRootPath(this.uiState.selectedRootPath.id);
      window.uiState.userPermissions = this.uiState.userPermissions;
      this.updateUploadAreaVisibility();
      
      console.log('[FileManager] ROOT_PATH選択完了:', this.uiState.selectedRootPath);
      
      // ROOT_PATH一覧の表示を更新
      try {
        await this.renderRootPathList();
      } catch (error) {
        console.error('[FileManager] renderRootPathListエラー:', error);
      }
      
      // ファイル一覧を再取得（ルートディレクトリから）
      this.uiState.currentPath = '';
      window.uiState.currentPath = '';
      await this.fetchFiles('');
      
    } catch (e) {
      console.error('[FileManager] ROOT_PATH選択エラー:', e);
      const errorDiv = document.getElementById('error');
      if (errorDiv) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = '';
      }
    }
  }

  /**
   * ファイル一覧を取得
   * @param {string} path 
   */
  async fetchFiles(path = '') {
    try {
      let url = '/api/list';
      const params = new URLSearchParams();
      
      if (path) {
        params.append('path', path);
      }
      
      // 選択中のROOT_PATHがある場合はパラメータに追加
      if (this.uiState.selectedRootPath && this.uiState.selectedRootPath.id) {
        params.append('rootPathId', this.uiState.selectedRootPath.id);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      console.log('[FileManager] fetchFiles リクエスト:', url);
      
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('ファイル一覧取得に失敗しました');
      const data = await res.json();
      
      this.uiState.currentPath = path;
      window.uiState.currentPath = path;
      
      // 権限を取得し直す
      if (this.uiState.selectedRootPath && this.uiState.selectedRootPath.id) {
        this.uiState.userPermissions = await this.fetchUserPermissionsForRootPath(this.uiState.selectedRootPath.id);
        window.uiState.userPermissions = this.uiState.userPermissions;
        this.updateUploadAreaVisibility();
      }
      
      await this.renderFiles(data.files || []);
      await this.renderBreadcrumb(path ? path.split('/').filter(Boolean) : []); // ルート
      this.renderParentButton();
      
      const fileTable = document.getElementById('file-table');
      const errorDiv = document.getElementById('error');
      if (fileTable) fileTable.style.display = '';
      if (errorDiv) errorDiv.style.display = 'none';
      
    } catch (e) {
      console.error('[FileManager] fetchFiles エラー:', e);
      const errorDiv = document.getElementById('error');
      const fileTable = document.getElementById('file-table');
      if (errorDiv) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = '';
      }
      if (fileTable) fileTable.style.display = 'none';
    }
  }

  /**
   * ファイル一覧をレンダリング
   * @param {Array} files 
   */
  async renderFiles(files) {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;
    
    // テンプレート用のデータを準備
    const templateData = files.map(f => {
      const isDir = f.type === 'dir';
      
      // 削除ボタンの表示制御
      const canDelete = this.uiState.userPermissions?.canDelete ?? true;
      const deleteButton = canDelete 
        ? `<button class="icon-btn" title="削除" onclick="deleteFile('${f.path}')"><span class="material-icons">delete</span></button>`
        : '';
      
      // ダウンロードURL生成（ROOT_PATHを考慮）
      const rootPathParam = this.uiState.selectedRootPath && this.uiState.selectedRootPath.id ? `&rootPathId=${this.uiState.selectedRootPath.id}` : '';
      const downloadFileUrl = `/api/download/file?path=${encodeURIComponent(f.path)}${rootPathParam}`;
      const downloadFolderUrl = `/api/download/folder?path=${encodeURIComponent(f.path)}${rootPathParam}`;
      
      return {
        name: f.name,
        path: f.path,
        isDir,
        size: f.size ?? '',
        mtime: f.mtime ?? '',
        downloadFileUrl,
        downloadFolderUrl,
        deleteButton
      };
    });
    
    try {
      const html = await renderTemplate('file-row', { files: templateData });
      fileList.innerHTML = html;
    } catch (error) {
      console.error('ファイル一覧テンプレートレンダリングエラー:', error);
      const html = await renderTemplate('error', { message: 'ファイル一覧の表示でエラーが発生しました' });
      fileList.innerHTML = `<tr><td colspan="5">${html}</td></tr>`;
    }
    
    this.updateFileToolbar();
  }

  /**
   * パンくずリストをレンダリング
   * @param {Array} pathArr 
   */
  async renderBreadcrumb(pathArr) {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    
    // パンくずリスト用のデータを準備
    const breadcrumbs = [];
    
    // ROOT_PATH名を最初に追加
    if (this.uiState.selectedRootPath) {
      breadcrumbs.push({
        name: this.uiState.selectedRootPath.name || 'root',
        path: '',
        isRootPath: true
      });
    }
    
    // パス要素を追加
    let currentPath = '';
    pathArr.forEach((p, i) => {
      currentPath += (i > 0 ? '/' : '') + p;
      breadcrumbs.push({
        name: p || 'root',
        path: currentPath,
        isRootPath: false
      });
    });
    
    try {
      const html = await renderTemplate('breadcrumb', { breadcrumbs });
      bc.innerHTML = html;
    } catch (error) {
      console.error('パンくずリストテンプレートレンダリングエラー:', error);
      const html = await renderTemplate('error', { message: 'パンくずリストの表示でエラーが発生しました' });
      bc.innerHTML = html;
    }
  }

  /**
   * ROOT_PATH一覧をレンダリング
   */
  async renderRootPathList() {
    // ROOT_PATHデータの復元・再取得処理
    if ((!this.uiState.rootPaths || this.uiState.rootPaths.length === 0) && this.rootPaths && this.rootPaths.length > 0) {
      this.uiState.rootPaths = this.rootPaths;
    }
    
    if ((!this.uiState.rootPaths || this.uiState.rootPaths.length === 0) && (!this.rootPaths || this.rootPaths.length === 0)) {
      try {
        await this.fetchRootPaths();
      } catch (error) {
        console.error('[FileManager] ROOT_PATH再取得エラー:', error);
      }
    }
    
    if (!this.uiState.rootPaths || this.uiState.rootPaths.length === 0) {
      return;
    }
    
    // containerの取得
    const container = document.getElementById('root-path-list-container');
    if (!container) {
      console.warn('[FileManager] root-path-list-container要素が見つかりません');
      return;
    }
    
    // テンプレート用のデータを準備
    const templateData = this.uiState.rootPaths.map(rp => {
      // ディスク容量表示用
      let diskInfo = '';
      if (rp.diskSpace) {
        const { total, free, used } = rp.diskSpace;
        // 単位変換（バイト→GB）
        const toGB = v => v != null ? (v / (1024 ** 3)).toFixed(1) : '?';
        diskInfo = `空き: ${toGB(free)}GB / 総容量: ${toGB(total)}GB`;
      }
      
      const isSelected = this.uiState.selectedRootPath && this.uiState.selectedRootPath.id === rp.id;
      
      return {
        id: rp.id,
        displayName: rp.name || rp.path || String(rp),
        description: rp.description || rp.name,
        isDefault: rp.isDefault,
        selected: isSelected,
        diskInfo
      };
    });
    
    try {
      const html = await renderTemplate('root-path-list', { rootPaths: templateData });
      container.innerHTML = html;
      container.style.display = 'block';
    } catch (error) {
      console.error('ROOT_PATH一覧テンプレートレンダリングエラー:', error);
      const html = await renderTemplate('error', { message: 'ROOT_PATH一覧の表示でエラーが発生しました' });
      container.innerHTML = html;
      container.style.display = 'block';
    }
  }

  /**
   * ディレクトリ遷移
   * @param {string} path 
   */
  async changeDir(path) {
    try {
      let url = '/api/list';
      const params = new URLSearchParams();
      
      if (path) {
        params.append('path', path);
      }
      
      // 選択中のROOT_PATHがある場合はパラメータに追加
      if (this.uiState.selectedRootPath && this.uiState.selectedRootPath.id) {
        params.append('rootPathId', this.uiState.selectedRootPath.id);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('ディレクトリ取得に失敗しました');
      const data = await res.json();
      
      this.uiState.currentPath = path;
      window.uiState.currentPath = path;
      
      // 権限を取得し直す
      if (this.uiState.selectedRootPath && this.uiState.selectedRootPath.id) {
        this.uiState.userPermissions = await this.fetchUserPermissionsForRootPath(this.uiState.selectedRootPath.id);
        window.uiState.userPermissions = this.uiState.userPermissions;
        this.updateUploadAreaVisibility();
      }
      
      await this.renderFiles(data.files || []);
      await this.renderBreadcrumb(path.split('/').filter(Boolean));
      this.renderParentButton();
      
      const fileTable = document.getElementById('file-table');
      const errorDiv = document.getElementById('error');
      if (fileTable) fileTable.style.display = '';
      if (errorDiv) errorDiv.style.display = 'none';
      
    } catch (e) {
      console.error('[FileManager] changeDir エラー:', e);
      const errorDiv = document.getElementById('error');
      const fileTable = document.getElementById('file-table');
      if (errorDiv) {
        errorDiv.textContent = e.message;
        errorDiv.style.display = '';
      }
      if (fileTable) fileTable.style.display = 'none';
    }
  }

  /**
   * ファイル削除
   * @param {string} path 
   */
  async deleteFile(path) {
    // 削除権限チェック
    if (this.uiState.userPermissions && !this.uiState.userPermissions.canDelete) {
      alert('削除権限がありません。');
      return;
    }
    
    if (!confirm(`${path} を削除しますか？`)) return;
    
    try {
      let url = '/api/delete/file';
      const params = new URLSearchParams();
      params.append('path', path);
      
      // 選択中のROOT_PATHがある場合はパラメータに追加
      if (this.uiState.selectedRootPath && this.uiState.selectedRootPath.id) {
        params.append('rootPathId', this.uiState.selectedRootPath.id);
      }
      
      url += '?' + params.toString();
      
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        await this.fetchFiles(this.uiState.currentPath);
      } else {
        const err = await res.json();
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
          errorDiv.textContent = err.error || '削除に失敗しました';
          errorDiv.style.display = '';
        }
      }
    } catch (error) {
      console.error('[FileManager] deleteFile エラー:', error);
      const errorDiv = document.getElementById('error');
      if (errorDiv) {
        errorDiv.textContent = '削除処理でエラーが発生しました';
        errorDiv.style.display = '';
      }
    }
  }

  /**
   * ファイルツールバーのボタン制御
   */
  updateFileToolbar() {
    const parentBtn = document.getElementById('parent-btn');
    if (!parentBtn) return;
    
    if (!this.uiState.currentPath || this.uiState.currentPath === '' || this.uiState.currentPath === undefined) {
      parentBtn.disabled = true;
      parentBtn.classList.add('disabled');
    } else {
      parentBtn.disabled = false;
      parentBtn.classList.remove('disabled');
    }
  }

  /**
   * 親ボタンの描画
   */
  renderParentButton() {
    // 既存実装を維持
  }

  /**
   * アップロード領域の表示制御
   */
  updateUploadAreaVisibility() {
    // upload-area削除済みのため何もしない（既存実装と同じ）
  }

  /**
   * ファイルアップロード処理
   * @param {FileList} files 
   */
  async handleUpload(files) {
    if (!this.uiState.userPermissions || !this.uiState.userPermissions.canUpload) {
      alert('アップロード権限がありません');
      return;
    }
    
    if (!this.uiState.selectedRootPath || !this.uiState.selectedRootPath.id) {
      alert('アップロード先ROOT_PATHが未選択です');
      return;
    }
    
    const uploadProgress = document.getElementById('upload-progress');
    if (uploadProgress) {
      uploadProgress.style.display = '';
      uploadProgress.textContent = 'アップロード中...';
    }
    
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    formData.append('rootPathId', this.uiState.selectedRootPath.id);
    formData.append('path', this.uiState.currentPath || '');
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (uploadProgress) {
          uploadProgress.textContent = 'アップロード完了: ' + data.uploaded.join(', ');
        }
        await this.fetchFiles(this.uiState.currentPath);
      } else {
        if (uploadProgress) {
          uploadProgress.textContent = 'アップロード失敗: ' + (data.error || '不明なエラー');
        }
      }
    } catch (e) {
      console.error('[FileManager] handleUpload エラー:', e);
      if (uploadProgress) {
        uploadProgress.textContent = 'アップロード失敗: ' + e.message;
      }
    }
    
    if (uploadProgress) {
      setTimeout(() => { uploadProgress.style.display = 'none'; }, 2000);
    }
  }
}
