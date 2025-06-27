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
    const response = await fetch(`/assets/${templateName}.tmp`);
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
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('log', function(arg1, arg2, options) {
  console.log('Handlebars log helper:', arg1, arg2);
  return '';
});

export { Handlebars };
