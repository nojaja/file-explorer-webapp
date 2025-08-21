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
    // file-cardパーシャルを初期化時に登録
    this.registerPartialURL('file-card', './assets/file-card.tmp');
  }

  init() {
    this.registerHelpers();
  }

  /**
   * 独自ヘルパーの登録
   */
  registerHelpers() {
    // concat: 文字列結合ヘルパー
    this.handlebars.registerHelper('concat', function() {
      // 最後の引数はoptionsオブジェクト
      return Array.from(arguments).slice(0, -1).join('');
    });
    // breaklines: 改行を<br />に変換
    this.handlebars.registerHelper("breaklines", function (text) {
      if (!text) return '';
      const ret = Handlebars.Utils.escapeExpression(text).replace(/\n/g, '<br />');
      return new Handlebars.SafeString(ret);
    });
    // ifEquals: 2値比較の条件分岐
    this.handlebars.registerHelper('ifEquals', function (arg1, arg2, _options) {
      return (arg1 == arg2) ? _options.fn(this) : _options.inverse(this);
    });
  // log:ログ出力用ヘルパー
  // 記載例： {{log var1 var2}}
    this.handlebars.registerHelper('log', function (arg1, arg2) {
      console.log('[Handlebars Helper Log]', arg1, arg2);
      return '';
    });
    // fetch: REST APIをコールしjsonをブロック内で参照できる非同期block helper
	this.handlebars.registerHelper('fetch', async function(apiUrl, _options) {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`fetch helper: API取得失敗: ${response.status}`);
        }
        const json = await response.json();
        // json全体をthisとして参照可能
        return await _options.fn(json);
      } catch (error) {
        console.error('fetch helper error:', error);
        if (_options.inverse) {
          return await _options.inverse(this);
        }
        return '';
      }
    });
    // srcにjs式を記載し、thisを明示的に参照する形で評価する（with文は使わない）
    this.handlebars.registerHelper('fn', function(src, options) {
      try {
        // thisのプロパティをローカル変数に展開し、optionsも参照可能にする
        // 例: src = "foo + bar + options.hash.suffix"
        const ctxKeys = Object.keys(this || {});
        const ctxValues = ctxKeys.map(k => this[k]);
        // optionsをローカル変数として追加
        const fn = new Function(...ctxKeys, 'options', `return (${src});`);
        const ret = fn(...ctxValues, options);
        return ret;
      } catch (e) {
        console.error('[fn helper] 式評価エラー:', e, src,this, options);
        return '';
      }
    });
  }

/**
 * テンプレートファイルを取得してコンパイル
 * @param {string} templateName - テンプレート名（拡張子なし）
 * @returns {Promise<Function>} - コンパイル済みテンプレート関数
 */
  async getPageTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const url = `./assets/${templateName}.tmp`;
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

  /**
   * テンプレートキャッシュをクリア
   */
  clearTemplateCache() {
    Object.keys(this.templateCache).forEach(key => {
      delete this.templateCache[key];
    });
  }
}

// グローバルインスタンス
const handlebarsFactory = new CustomHandlebarsFactory();

/**
 * テンプレートをレンダリングしてHTML文字列を取得
 * @param {string} templateName - テンプレート名
 * @param {Object} context - テンプレートに渡すデータ
 * @returns {Promise<string>} - レンダリング済みHTML文字列
 */
export async function renderTemplate(templateName, context = {}) {
  try {
    const template = await handlebarsFactory.getPageTemplate(templateName);
    // promised-handlebarsのtemplate関数は常にPromiseを返すため、awaitが必要
    const html = await template(context);
    return html;
  } catch (error) {
    console.error(`[renderTemplate] レンダリングエラー (${templateName}):`, error);
    throw error;
  }
}

export { handlebarsFactory };
