// Hydra URL置換用ミドルウェア
// ブラウザがhydraコンテナ名で直接アクセスできないため、
// レスポンス内のコンテナURL（hydra:4444/hydra:4445）をブラウザアクセス用URL（localhost:4444/localhost:4445）に置き換える
import { getAuthProviderConfig } from '../authProviderConfig.js';

// Hydra URL置換用ミドルウェア
export function hydraUrlReplaceMiddleware(req, res, next) {
  const originalSend = res.send;
  const originalRedirect = res.redirect;

  // FQDNごとのHydra URLの情報を取得
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const hydraConfig = getAuthProviderConfig(fqdn, 'hydra');
  if (!hydraConfig) {
    next();
    return;
  }
  const hydraAuthContainerUrl = hydraConfig.HYDRA_AUTH_URL_INTERNAL;
  const hydraAuthBrowserUrl = hydraConfig.HYDRA_AUTH_URL;
  const hydraAdminContainerUrl = hydraConfig.HYDRA_ADMIN_URL_INTERNAL;
  const hydraAdminBrowserUrl = hydraConfig.HYDRA_ADMIN_URL;

  // クエリパラメータの処理
  const processUrl = (url) => {
    if (!url) return url;

    let processedUrl = url;
    // Hydra Authの置換
    if (hydraAuthContainerUrl && processedUrl.includes(hydraAuthContainerUrl)) {
      console.log(`[hydraUrlReplace] URLにHydra Auth コンテナURL検出: ${url}`);
      processedUrl = processedUrl.replace(new RegExp(hydraAuthContainerUrl, 'g'), hydraAuthBrowserUrl);
      console.log(`[hydraUrlReplace] 修正後URL: ${processedUrl}`);
    }

    // Hydra Adminの置換
    if (hydraAdminContainerUrl && processedUrl.includes(hydraAdminContainerUrl)) {
      console.log(`[hydraUrlReplace] URLにHydra Admin コンテナURL検出: ${url}`);
      processedUrl = processedUrl.replace(new RegExp(hydraAdminContainerUrl, 'g'), hydraAdminBrowserUrl);
      console.log(`[hydraUrlReplace] 修正後URL: ${processedUrl}`);
    }

    return processedUrl;
  };

  // リクエストURLの処理
  if (req.url) {
    req.url = processUrl(req.url);
  }

  // レスポンスリダイレクトをオーバーライド
  res.redirect = function(status, url) {
    try {
      // status引数がオプションの場合の処理
      let redirectUrl = url;
      let redirectStatus = status;

      if (typeof status === 'string') {
        redirectUrl = status;
        redirectStatus = 302; // デフォルトステータスコード
      }
      
      // URLの処理
      const modifiedUrl = processUrl(redirectUrl);

      if (modifiedUrl !== redirectUrl) {
        return originalRedirect.call(this, redirectStatus, modifiedUrl);
      }
    } catch (err) {
      console.error('[hydraUrlReplace] リダイレクト処理エラー:', err);
    }
    
    // 元のredirect関数を呼び出す
    return originalRedirect.apply(this, arguments);
  };

  // レスポンスボディを処理するオーバーライド関数
  res.send = function(body) {
    try {
      // レスポンスがHTMLまたはJSONの場合のみ処理
      const contentType = res.getHeader('content-type');

      if (typeof body === 'string' &&
         (contentType?.includes('text/html') || contentType?.includes('application/json') || contentType?.includes('text/plain'))) {

        let modifiedBody = body;
        let modified = false;
        
        // Hydra AuthのコンテナURLをブラウザアクセス用URLに置換
        if (hydraAuthContainerUrl && body.includes(hydraAuthContainerUrl)) {
          console.log(`[hydraUrlReplace] レスポンスボディにHydra Auth コンテナURL検出`);
          modifiedBody = modifiedBody.replace(new RegExp(hydraAuthContainerUrl, 'g'), hydraAuthBrowserUrl);
          modified = true;
        }
        
        // Hydra AdminのコンテナURLをブラウザアクセス用URLに置換
        if (hydraAdminContainerUrl && body.includes(hydraAdminContainerUrl)) {
          console.log(`[hydraUrlReplace] レスポンスボディにHydra Admin コンテナURL検出`);
          modifiedBody = modifiedBody.replace(new RegExp(hydraAdminContainerUrl, 'g'), hydraAdminBrowserUrl);
          modified = true;
        }
        
        // 修正されたボディで元のsend関数を呼び出す
        if (modified) {
          return originalSend.call(this, modifiedBody);
        }
      }
    } catch (err) {
      console.error('[hydraUrlReplace] 処理エラー:', err);
    }
    
    // 元のsend関数を呼び出す
    return originalSend.call(this, body);
  };

  next();
}
