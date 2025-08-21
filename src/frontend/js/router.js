import { renderTemplate} from './view.js';
import { FileManager } from './file.js';

/**
 * SPAルーティング管理
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.fileManager = FileManager.getInstance();
    this.init();
  }

  init() {
    window.addEventListener('popstate', this.onRoute.bind(this));
    window.addEventListener('DOMContentLoaded', this.onRoute.bind(this));
  }

  /**
   * ルートを登録
   * @param {string} path 
   * @param {Function} handler 
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * ページ遷移（pageGen相当）
   * @param {string} pagename 
   * @param {string|null} id 
   * @param {Object} options 
   */
  async pageGen(pagename, id = null, options = {}) {
    try {
      // 1. URL制御・履歴管理
      const url = new URL(window.location);
      url.searchParams.set('q', pagename);
      if (id) url.searchParams.set('id', id);
      
      if (!options.skipHistory) {
        history.pushState({ page: pagename, id }, '', url);
      }

      // 2. テンプレートファイルの取得
      const templateName = this.getTemplateName(pagename);
      
      // 3. データ取得（Model層の実行）
      const context = await this.fetchPageData(pagename, id, options);
      console.log(`[Router.pageGen] templateName: ${templateName}, context:  `, context);
      // 4. テンプレートレンダリング・画面の描画
      const html = await renderTemplate(templateName, context);
      // app要素に描画
      const appElement = document.getElementById('app');
      if (!appElement) {
        throw new Error('app要素が見つかりません');
      }
      appElement.innerHTML = html;

      this.currentRoute = { page: pagename, id };
      
    } catch (error) {
      console.error('[Router] pageGen エラー:', error);
      await this.handleError(error);
    }
  }

  /**
   * URL変化時のルート処理
   */
  async onRoute() {
    try {
      const params = new URLSearchParams(location.search);
      const page = params.get('q') || 'main';
      const id = params.get('id');
      
      await this.pageGen(page, id, { skipHistory: true });
      
    } catch (error) {
      console.error('[Router] onRoute エラー:', error);
      await this.handleError(error);
    }
  }

  /**
   * テンプレート名の決定
   * @param {string} pagename 
   * @returns {string}
   */
  getTemplateName(pagename) {
    const templateMap = {
      'main': 'main',
      'file': 'main', // ファイル表示も同じテンプレート
      'error': 'error'
    };
    return templateMap[pagename] || 'main';
  }

  /**
   * ページデータの取得
   * @param {string} pagename 
   * @param {string|null} id 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async fetchPageData(pagename, id) {
    switch (pagename) {
      case 'main':
      case 'file':
        return await this.fetchMainPageData(id);
      default:
        return {};
    }
  }

  /**
   * メインページのデータ取得
   * @param {string|null} path 
   * @returns {Promise<Object>}
   */
  async fetchMainPageData(path = '') {
    try {
      // サイドバーデータを取得
      const sidebarData = await this.fetchSidebarData();
      
      // rootPathIdはUI状態から取得
      const rootPathId = this.fileManager.uiState?.selectedRootPath?.id || '';
      const apiUrl = './api/list?rootPathId=' + encodeURIComponent(rootPathId) + (path ? '&path=' + encodeURIComponent(path) : '');
      return {
        sidebar: await renderTemplate('sidebar', sidebarData),
        path: path || '',
        currentPath: path || '',
        rootPathId,
        apiUrl
      };
    } catch (error) {
      console.error('[Router] fetchMainPageData エラー:', error);
      throw error;
    }
  }

  /**
   * サイドバーデータの取得
   * @returns {Promise<Object>}
   */
  async fetchSidebarData() {
    // 既存の認証状態とROOT_PATH情報を取得
    return {
      authenticated: window.isAuthenticated || false,
      rootPaths: window.rootPaths || [],
      selectedRootPath: this.fileManager.uiState?.selectedRootPath || null
    };
  }

  /**
   * エラーハンドリング
   * @param {Error} error 
   */
  async handleError(error) {
    try {
      const context = {
        sidebar: await renderTemplate('sidebar', {}),
        error: error.message
      };
      const html = await renderTemplate('main', context);
      // app要素に描画
      const appElement = document.getElementById('app');
      if (!appElement) {
        throw new Error('app要素が見つかりません');
      }
      appElement.innerHTML = html;

    } catch (renderError) {
      console.error('[Router] エラーレンダリング失敗:', renderError);
      // Handlebarsテンプレートでエラー表示
      try {
        const errorHtml = await renderTemplate('error', { message: error.message });
        document.getElementById('app').innerHTML = errorHtml;
      } catch (errorTemplateError) {
        console.error('[Router] エラーテンプレートレンダリング失敗:', errorTemplateError);
        // テンプレート取得失敗時も最低限のエラー表示
        const fallbackHtml = await renderTemplate('error', { message: error.message });
        document.getElementById('app').innerHTML = fallbackHtml;
      }
    }
  }
}

export const router = new Router();
export default router;
