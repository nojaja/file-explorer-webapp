import Handlebars from 'handlebars';
import promisedHandlebars from 'promised-handlebars';

/**
 * CustomHandlebarsFactory - 拡張されたHandlebarsインスタンス
 */
export class CustomHandlebarsFactory {
  constructor() {
    // promised-handlebarsでラップしてPromise対応
    this.handlebars = promisedHandlebars(Handlebars);
    this.templateCache = new Map();
    this.partialCache = new Map();
    this.init();
  }

  init() {
    this.registerHelpers();
  }

  /**
   * 独自ヘルパーの登録
   */
  registerHelpers() {
    // breaklines: 改行を<br />に変換
    this.handlebars.registerHelper("breaklines", function (text) {
      if (!text) return '';
      const ret = Handlebars.Utils.escapeExpression(text).replace(/\n/g, '<br />');
      return new Handlebars.SafeString(ret);
    });

    // ifEquals: 2値比較の条件分岐
    this.handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // log: デバッグ用ログ出力
    this.handlebars.registerHelper('log', function (arg1, arg2, options) {
      console.log('[Handlebars Helper Log]', arg1, arg2);
      return '';
    });
  }

  /**
   * テンプレートファイルの取得（キャッシュ付き）
   * @param {string} templateName 
   * @returns {Promise<Function>}
   */
  async getPageTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const url = `/assets/${templateName}.tmp`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`テンプレート取得失敗: ${url} (${response.status})`);
      }
      
      const templateSource = await response.text();
      const template = this.handlebars.compile(templateSource);
      
      // キャッシュに保存
      this.templateCache.set(templateName, template);
      return template;
      
    } catch (error) {
      console.error(`[CustomHandlebarsFactory] テンプレート取得エラー (${templateName}):`, error);
      throw error;
    }
  }

  /**
   * パーシャルの動的登録
   * @param {string} partialName 
   * @param {string} url 
   */
  async registerPartialURL(partialName, url) {
    if (this.partialCache.has(partialName)) {
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`パーシャル取得失敗: ${url} (${response.status})`);
      }
      
      const partialSource = await response.text();
      this.handlebars.registerPartial(partialName, partialSource);
      this.partialCache.set(partialName, partialSource);
      
    } catch (error) {
      console.error(`[CustomHandlebarsFactory] パーシャル登録エラー (${partialName}):`, error);
      throw error;
    }
  }
}

// グローバルインスタンス
const handlebarsFactory = new CustomHandlebarsFactory();

/**
 * テンプレートのレンダリング
 * @param {string} templateName 
 * @param {Object} context 
 * @returns {Promise<void>}
 */
export async function renderTemplate(templateName, context = {}) {
  try {
    const template = await handlebarsFactory.getPageTemplate(templateName);
    
    // promised-handlebarsのtemplate関数は常にPromiseを返すため、awaitが必要
    const html = await template(context);
    
    // app要素に描画
    const appElement = document.getElementById('app');
    if (!appElement) {
      throw new Error('app要素が見つかりません');
    }
    
    appElement.innerHTML = html;
    
  } catch (error) {
    console.error(`[renderTemplate] レンダリングエラー (${templateName}):`, error);
    throw error;
  }
}

/**
 * パーシャルテンプレートのレンダリング（部分描画用）
 * @param {string} templateName 
 * @param {Object} context 
 * @returns {Promise<string>}
 */
export async function renderPartialTemplate(templateName, context = {}) {
  try {
    const template = await handlebarsFactory.getPageTemplate(templateName);
    
    // promised-handlebarsのtemplate関数は常にPromiseを返すため、awaitが必要
    const html = await template(context);
    
    return html;
    
  } catch (error) {
    console.error(`[renderPartialTemplate] パーシャルレンダリングエラー (${templateName}):`, error);
    throw error;
  }
}

export { handlebarsFactory };
