// GitLabのURL置換用ミドルウェア
// ブラウザがgitlabコンテナ名で直接アクセスできないため、
// レスポンス内のコンテナURL（gitlab:8929）をブラウザアクセス用URL（localhost:8929）に置き換える
import { getAuthProviderConfig } from '../authProviderConfig.js';

// GitLabのURL置換用ミドルウェア
export function gitlabUrlReplaceMiddleware(req, res, next) {
  const originalSend = res.send;
  const originalRedirect = res.redirect;

  // FQDNごとのGitLab URLの情報を取得
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const gitlabConfig = getAuthProviderConfig(fqdn, 'gitlab');
  if (!gitlabConfig) {
    next();
    return;
  }
  const gitlabContainerUrl = gitlabConfig.GITLAB_URL_INTERNAL;
  const gitlabBrowserUrl = gitlabConfig.GITLAB_URL;

  // クエリパラメータの処理
  const processUrl = (url) => {
    if (!url) return url;

    let processedUrl = url;
    // Hydra Authの置換
    if (gitlabContainerUrl && processedUrl.includes(gitlabContainerUrl)) {
      console.log(`[gitlabUrlReplace] URLにコンテナURL検出: ${url}`);
      processedUrl = processedUrl.replace(new RegExp(gitlabContainerUrl, 'g'), gitlabBrowserUrl);
      console.log(`[gitlabUrlReplace] 修正後URL: ${url}`);
    }

    return processedUrl;
  };

  // リクエストURLの処理
  if (req.url) {
    req.url = processUrl(req.url);
  }

  // レスポンスリダイレクトをオーバーライド
  res.redirect = function (status, url) {
    try {
      // status引数がオプションの場合の処理
      let redirectUrl = url;
      let redirectStatus = status;

      if (typeof status === 'string') {
        redirectUrl = status;
        redirectStatus = 302; // デフォルトステータスコード
      }
      if (redirectUrl && gitlabContainerUrl && redirectUrl.includes(gitlabContainerUrl)) {
        console.log(`[gitlabUrlReplace] リダイレクトURLにコンテナURL検出: ${redirectUrl}`);
        const modifiedUrl = redirectUrl.replace(new RegExp(gitlabContainerUrl, 'g'), gitlabBrowserUrl);
        console.log(`[gitlabUrlReplace] 修正後リダイレクトURL: ${modifiedUrl}`);
        return originalRedirect.call(this, redirectStatus, modifiedUrl);
      }
    } catch (err) {
      console.error('[gitlabUrlReplace] リダイレクト処理エラー:', err);
    }

    // 元のredirect関数を呼び出す
    return originalRedirect.apply(this, arguments);
  };

  // レスポンスボディを処理するオーバーライド関数
  res.send = function (body) {
    try {
      // レスポンスがHTMLまたはJSONの場合のみ処理
      const contentType = res.getHeader('content-type');

      if (typeof body === 'string' &&
        (contentType?.includes('text/html') || contentType?.includes('application/json') || contentType?.includes('text/plain'))) {

        // GitLabのコンテナURLをブラウザアクセス用URLに置換
        if (gitlabContainerUrl && body.includes(gitlabContainerUrl)) {
          console.log(`[gitlabUrlReplace] レスポンスボディにコンテナURL検出`);

          // URLを置換
          const modifiedBody = body.replace(new RegExp(gitlabContainerUrl, 'g'), gitlabBrowserUrl);

          // 修正されたボディで元のsend関数を呼び出す
          return originalSend.call(this, modifiedBody);
        }
      }
    } catch (err) {
      console.error('[gitlabUrlReplace] 処理エラー:', err);
    }

    // 元のsend関数を呼び出す
    return originalSend.call(this, body);
  };

  next();
}
