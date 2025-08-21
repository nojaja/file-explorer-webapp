// Hydra URL置換用ミドルウェア
// ブラウザがhydraコンテナ名で直接アクセスできないため、
// レスポンス内のコンテナURL（hydra:4444/hydra:4445）をブラウザアクセス用URL（localhost:4444/localhost:4445）に置き換える
import { getAuthProviderConfig } from '../authProviderConfig.js';

function _processUrl(url, hydraConfig) {
  if (!url) return url;
  let processedUrl = url;
  const authContainer = hydraConfig.HYDRA_AUTH_URL_INTERNAL;
  const authBrowser = hydraConfig.HYDRA_AUTH_URL;
  const adminContainer = hydraConfig.HYDRA_ADMIN_URL_INTERNAL;
  const adminBrowser = hydraConfig.HYDRA_ADMIN_URL;

  if (authContainer && processedUrl.includes(authContainer)) {
    console.log(`[hydraUrlReplace] URLにHydra Auth コンテナURL検出: ${url}`);
    processedUrl = processedUrl.replace(new RegExp(authContainer, 'g'), authBrowser);
    console.log(`[hydraUrlReplace] 修正後URL: ${processedUrl}`);
  }

  if (adminContainer && processedUrl.includes(adminContainer)) {
    console.log(`[hydraUrlReplace] URLにHydra Admin コンテナURL検出: ${url}`);
    processedUrl = processedUrl.replace(new RegExp(adminContainer, 'g'), adminBrowser);
    console.log(`[hydraUrlReplace] 修正後URL: ${processedUrl}`);
  }

  return processedUrl;
}

function _createRedirectOverride(originalRedirect, hydraConfig) {
  return function redirectOverride(status, url) {
    try {
      let redirectUrl = url;
      let redirectStatus = status;
      if (typeof status === 'string') {
        redirectUrl = status;
        redirectStatus = 302;
      }
      const modifiedUrl = _processUrl(redirectUrl, hydraConfig);
      if (modifiedUrl !== redirectUrl) {
        return originalRedirect.call(this, redirectStatus, modifiedUrl);
      }
    } catch (err) {
      console.error('[hydraUrlReplace] リダイレクト処理エラー:', err);
    }
    return originalRedirect.apply(this, arguments);
  };
}

function _createSendOverride(originalSend, hydraConfig) {
  return function sendOverride(body) {
    try {
      const contentType = this.getHeader ? this.getHeader('content-type') : null;
      if (typeof body === 'string' &&
         (contentType?.includes('text/html') || contentType?.includes('application/json') || contentType?.includes('text/plain'))) {
        const { modified, modifiedBody } = _replaceBodyUrls(body, hydraConfig);
        if (modified) return originalSend.call(this, modifiedBody);
      }
    } catch (err) {
      console.error('[hydraUrlReplace] 処理エラー:', err);
    }
    return originalSend.call(this, body);
  };
}

function _replaceBodyUrls(body, hydraConfig) {
  let modifiedBody = body;
  let modified = false;
  const authContainer = hydraConfig.HYDRA_AUTH_URL_INTERNAL;
  const authBrowser = hydraConfig.HYDRA_AUTH_URL;
  const adminContainer = hydraConfig.HYDRA_ADMIN_URL_INTERNAL;
  const adminBrowser = hydraConfig.HYDRA_ADMIN_URL;
  if (authContainer && body.includes(authContainer)) {
    console.log('[hydraUrlReplace] レスポンスボディにHydra Auth コンテナURL検出');
    modifiedBody = modifiedBody.replace(new RegExp(authContainer, 'g'), authBrowser);
    modified = true;
  }
  if (adminContainer && body.includes(adminContainer)) {
    console.log('[hydraUrlReplace] レスポンスボディにHydra Admin コンテナURL検出');
    modifiedBody = modifiedBody.replace(new RegExp(adminContainer, 'g'), adminBrowser);
    modified = true;
  }
  return { modified, modifiedBody };
}

// Hydra URL置換用ミドルウェア
export function hydraUrlReplaceMiddleware(req, res, next) {
  const originalSend = res.send;
  const originalRedirect = res.redirect;

  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const hydraConfig = getAuthProviderConfig(fqdn, 'hydra');
  if (!hydraConfig) {
    next();
    return;
  }

  if (req.url) req.url = _processUrl(req.url, hydraConfig);

  res.redirect = _createRedirectOverride(originalRedirect, hydraConfig);
  res.send = _createSendOverride(originalSend, hydraConfig);

  next();
}
