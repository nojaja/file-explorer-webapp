# API設計（ファイルエクスプローラWebアプリ）

## 認証
- OAUTH2.0（github, gitlab）
- 認証必須エンドポイントには認証ミドルウェアを適用

## API一覧

### 1. ファイル・フォルダ一覧取得
- `GET /api/list`
- クエリ: `path`（省略時はルート）
- 認証: 必須
- レスポンス例:
```json
{
  "path": "/subdir",
  "folders": ["foo", "bar"],
  "files": ["a.txt", "b.jpg"]
}
```

### 2. ファイルダウンロード
- `GET /api/download/file`
- クエリ: `path`（ファイルパス）
- 認証: 必須
- レスポンス: ファイル本体（Content-Disposition: attachment）

### 3. フォルダダウンロード（zip化・stream）
- `GET /api/download/folder`
- クエリ: `path`（フォルダパス）
- 認証: 必須
- レスポンス: zipストリーム（Content-Disposition: attachment）

### 4. ファイル削除
- `DELETE /api/delete/file`
- ボディ: `{ "path": "対象ファイルパス" }`
- 認証: 必須
- レスポンス: `{ "success": true }`

### 5. フォルダ削除
- `DELETE /api/delete/folder`
- ボディ: `{ "path": "対象フォルダパス" }`
- 認証: 必須
- レスポンス: `{ "success": true }`

### 6. ログイン・ログアウト
- `GET /auth/github` / `GET /auth/gitlab` : OAUTH認証開始
- `GET /auth/callback` : OAUTHコールバック
- `GET /auth/logout` : ログアウト

## エラーレスポンス例
```json
{
  "error": "ファイルが存在しません"
}
```

## 備考
- すべてのパスは環境変数ROOT_PATH配下のみ許可
- 認証情報はセッション/クッキーで管理
- APIは日本語エラーメッセージ
