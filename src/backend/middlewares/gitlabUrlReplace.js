// GitLabのURL置換用ミドルウェア
// ブラウザがgitlabコンテナ名で直接アクセスできないため、
// レスポンス内のコンテナURL（gitlab:8929）をブラウザアクセス用URL（localhost:8929）に置き換える

export function gitlabUrlReplaceMiddleware(req, res, next) {
  const originalSend = res.send;
  const originalRedirect = res.redirect;
  
  // GitLab URLの情報を取得
  const gitlabContainerUrl = process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929';
  const gitlabBrowserUrl = process.env.GITLAB_URL || 'http://localhost:8929';
  
  // クエリパラメータの処理
  if (req.url && req.url.includes(gitlabContainerUrl)) {
    console.log(`[gitlabUrlReplace] リクエストURLにコンテナURL検出: ${req.url}`);
    req.url = req.url.replace(new RegExp(gitlabContainerUrl, 'g'), gitlabBrowserUrl);
    console.log(`[gitlabUrlReplace] 修正後リクエストURL: ${req.url}`);
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
      
      if (redirectUrl && redirectUrl.includes(gitlabContainerUrl)) {
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
  res.send = function(body) {
    try {
      // レスポンスがHTMLまたはJSONの場合のみ処理
      const contentType = res.getHeader('content-type');
      
      if (typeof body === 'string' && 
         (contentType?.includes('text/html') || contentType?.includes('application/json') || contentType?.includes('text/plain'))) {
        
        // GitLabのコンテナURLをブラウザアクセス用URLに置換
        if (body.includes(gitlabContainerUrl)) {
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
