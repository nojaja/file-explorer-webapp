# GitLab OAuth設定手順

このドキュメントでは、Docker上で動作するGitLabインスタンスでOAuth認証を設定する手順を説明します。

## 1. GitLabへのアクセス

GitLabコンテナは `http://localhost:8929` でアクセスできます。

1. ブラウザで `http://localhost:8929` にアクセス
2. 初回アクセス時はroot用パスワードの設定が必要です
   - ユーザー名: `root`
   - パスワード: 任意の安全なパスワードを設定（8文字以上必要）

## 2. アプリケーション登録

1. GitLabにログインした状態で、右上のユーザーアイコン → 「Settings」をクリック
2. 左側のサイドメニューから「Applications」をクリック
3. 以下の情報を入力：
   - Name: `File Explorer WebApp`
   - Redirect URI: `http://localhost:3000/auth/callback`
   - Scopes: `read_user`にチェック
4. 「Save application」ボタンをクリック

## 3. クライアントIDとシークレットの取得

アプリケーション登録後、以下の情報が表示されます：
- Application ID (クライアントID)
- Secret (クライアントシークレット)

これらの値を控えてください。

## 4. 環境変数の設定

プロジェクトのルートディレクトリにある `.env` ファイルを開き、以下の値を更新：

```
GITLAB_CLIENT_ID=取得したApplication ID
GITLAB_CLIENT_SECRET=取得したSecret
OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
```

## 5. アプリケーションの再起動

環境変数を更新した後、アプリケーションを再起動：

```bash
# プロジェクトのルートディレクトリで
npm run start
```

## トラブルシューティング

### CSRF検証エラー

GitLabのOAuth認証で「CSRF検証に失敗しました」というエラーが表示される場合：
- ブラウザのCookieをクリア
- 異なるブラウザでアクセス
- シークレットモードでアクセス

### リダイレクトURIエラー

「リダイレクトURIが無効です」というエラーが表示される場合：
- GitLabのアプリケーション設定で正確なリダイレクトURIが入力されていることを確認
- 末尾のスラッシュの有無に注意
- 大文字小文字も正確に一致させる

### アクセストークン取得エラー

アクセストークンの取得に失敗する場合：
- クライアントIDとシークレットが正しく設定されているか確認
- ネットワーク接続を確認
