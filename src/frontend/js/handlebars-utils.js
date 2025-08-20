import _Handlebars from 'handlebars';
import promisedHandlebars from 'promised-handlebars';

// promised-handlebarsでラップしてPromise対応
const Handlebars = promisedHandlebars(_Handlebars);

// テンプレートキャッシュ
const templateCache = {};

/**
 * テンプレートファイルを取得してコンパイル
 * @param {string} templateName - テンプレート名（拡張子なし）
 * @returns {Promise<Function>} - コンパイル済みテンプレート関数
 */
export async function getTemplate(templateName) {
  if (templateCache[templateName]) {
    return templateCache[templateName];
  }

  try {
    const response = await fetch(`./assets/${templateName}.tmp`);
    if (!response.ok) {
      throw new Error(`テンプレート ${templateName} の取得に失敗しました: ${response.status}`);
    }
    
    const templateSource = await response.text();
    const template = Handlebars.compile(templateSource);
    
    // キャッシュに保存
    templateCache[templateName] = template;
    
    return template;
  } catch (error) {
    console.error('テンプレート取得エラー:', error);
    throw error;
  }
}

/**
 * テンプレートをレンダリングしてHTML文字列を取得
 * @param {string} templateName - テンプレート名
 * @param {Object} context - テンプレートに渡すデータ
 * @returns {Promise<string>} - レンダリング済みHTML文字列
 */
export async function renderTemplate(templateName, context = {}) {
  console.log('handlebars-utils.js renderTemplate');
  try {
    const template = await getTemplate(templateName);
    // promised-handlebarsでラップしたテンプレート関数は常にPromiseを返す
    const html = await template(context);
    return html;
  } catch (error) {
    console.error('テンプレートレンダリングエラー:', error);
    throw error;
  }
}

/**
 * テンプレートキャッシュをクリア
 */
export function clearTemplateCache() {
  Object.keys(templateCache).forEach(key => {
    delete templateCache[key];
  });
}

// Handlebarsヘルパーの登録
// 文字列結合用concatヘルパー
Handlebars.registerHelper('concat', function() {
  console.log('handlebars-utils.js concatヘルパー');
  // 最後の引数はoptionsオブジェクト
  return Array.from(arguments).slice(0, -1).join('');
});
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  console.log('handlebars-utils.js ifEqualsヘルパー');
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

// ログ出力用ヘルパー
// 記載例： {{log var1 var2}}
Handlebars.registerHelper('log', function(arg1, arg2, options) {
  console.log('Handlebars log helper:', arg1, arg2);
  return '';
});

// 非同期fetch block helper
Handlebars.registerHelper('fetch', async function(apiUrl, options) {
  console.log('handlebars-utils.js fetchヘルパー');
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`fetch helper: API取得失敗: ${response.status}`);
    }
    const json = await response.json();
    // ブロック内でjsonをthisとして参照可能
    return await options.fn(json);
  } catch (error) {
    console.error('fetch helper error:', error);
    // エラー時はinverseブロックを呼び出し
    if (options.inverse) {
      return await options.inverse(this);
    }
    return '';
  }
});

// srcにjs式を記載し、thisを明示的に参照する形で評価する（with文は使わない）
Handlebars.registerHelper('fn', function(src, options) {
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

export { Handlebars };
