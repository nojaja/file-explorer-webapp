# GitLab OAuth認証の問題解決

## 実装されたコンポーネント

### 1. GitLab URL環境変数（.env）
```properties
# GitLab URL (サーバー間通信用)
GITLAB_URL=http://gitlab:8929
# GitLab URL (ブラウザアクセス用)
GITLAB_URL_BROWSER=http://localhost:8929
```

### 2. GitLabストラテジー設定（index.js）
```javascript
passport.use(new GitLabStrategy({
  clientID: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  callbackURL: process.env.OAUTH_CALLBACK_URL,
  baseURL: process.env.GITLAB_URL_BROWSER || 'http://localhost:8929', // ブラウザ向けURLを使用
  tokenURL: process.env.GITLAB_URL + '/oauth/token', // トークン取得用（内部URL使用）
  authorizationURL: process.env.GITLAB_URL_BROWSER + '/oauth/authorize', // 認証画面（ブラウザURL使用）
}, function(accessToken, refreshToken, profile, done) {
  // 認証ハンドラーの実装
  return done(null, profile);
}));
```

### 3. GitLab専用のトークンヘルパー（gitlabTokenHelper.js）
```javascript
export async function getGitLabToken(code, clientId, clientSecret, callbackUrl) {
  try {
    // 内部通信用のGitLab URLを使用
    const gitlabUrl = process.env.GITLAB_URL || 'http://gitlab:8929';
    const tokenEndpoint = `${gitlabUrl}/oauth/token`;
    
    console.log(`[gitlabTokenHelper] トークン取得リクエスト: ${tokenEndpoint}`);
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`トークン取得失敗: ${response.status} ${error}`);
    }
    
    const tokenData = await response.json();
    console.log('[gitlabTokenHelper] トークン取得成功');
    return tokenData;
  } catch (error) {
    console.error('[gitlabTokenHelper] トークン取得例外:', error);
    throw error;
  }
}
```

### 4. URL置換ミドルウェア（gitlabUrlReplace.js）
```javascript
export function gitlabUrlReplaceMiddleware(req, res, next) {
  const originalSend = res.send;
  const gitlabContainerUrl = process.env.GITLAB_URL || 'http://gitlab:8929';
  const gitlabBrowserUrl = process.env.GITLAB_URL_BROWSER || 'http://localhost:8929';
  
  // レスポンスボディを処理するオーバーライド関数
  res.send = function(body) {
    if (typeof body === 'string' && body.includes(gitlabContainerUrl)) {
      // GitLabのコンテナURLをブラウザアクセス用URLに置換
      const modifiedBody = body.replace(new RegExp(gitlabContainerUrl, 'g'), gitlabBrowserUrl);
      return originalSend.call(this, modifiedBody);
    }
    return originalSend.call(this, body);
  };
  
  next();
}
```

### 5. 拡張認証ミドルウェア（auth.js）
```javascript
export function ensureAuthenticated(req, res, next) {
  // カスタムセッション認証チェック
  if (req.session?.isAuthenticated) {
    return next();
  }
  
  // 通常のPassport認証チェック
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ error: "認証が必要です" });
}
```

## 問題の分析と解決

### 問題の本質
- Docker環境ではコンテナ間通信とブラウザからのアクセスでURLが異なる
- サーバーはGitLabコンテナに対して`http://gitlab:8929`でアクセスする必要がある
- ブラウザからは`http://localhost:8929`でアクセスする必要がある
- URLが混在すると認証フローが途中で失敗する

### 解決アプローチ
1. **環境変数での明示的な分離**
   - 内部通信用とブラウザアクセス用のURLを明確に区別
   - 用途に応じて適切なURLを使用

2. **GitLabストラテジーの細かな設定**
   - `baseURL`: ブラウザ向けURL（GitLabのUIにアクセスするため）
   - `tokenURL`: 内部URLを指定（サーバー間でのトークン取得）
   - `authorizationURL`: ブラウザURLを使用（認証画面表示）

3. **カスタムトークンヘルパーの実装**
   - 内部URLを使用してトークン取得APIを直接呼び出し
   - 詳細なエラーハンドリングとログ記録

4. **URL置換ミドルウェア**
   - レスポンス内のコンテナURLをブラウザアクセス用URLに置換
   - リダイレクトとレスポンスボディの両方で対応

5. **複数認証方式の統合**
   - 標準のPassport認証とカスタム認証の両方をサポート
   - セッションベースの認証管理

## テクニカルポイント

1. **Docker環境で注意すべきこと**
   - コンテナ名はブラウザからは解決できない
   - ホスト名とコンテナ名の切り替えが必要
   - ポート転送の設定を正確に行う

2. **OAuth認証でのURLの重要性**
   - 認証、トークン取得、リダイレクトで異なるURLが必要な場合がある
   - コールバックURLは登録時と一致する必要がある

3. **セキュリティ考慮事項**
   - トークンの安全な保管
   - セッション管理の適切な実装
   - HTTPS対応の検討
