# ファイルエクスプローラ Webアプリ

## 概要
特定のフォルダ配下のファイル・フォルダをWeb UIで操作できるNode.jsアプリ（Docker対応）

## 主な機能
- ファイル・フォルダ一覧表示
- ファイル/フォルダのダウンロード・削除
- フォルダのzipダウンロード（stream対応）
- OAUTH認証（github/gitlab）
- 日本語UI

## セットアップ
```sh
# 依存パッケージインストール
npm install
```

## 環境変数
- .env.example を参照

## Docker
```sh
docker build -t file-explorer-webapp .
docker run --env-file .env -p 3000:3000 file-explorer-webapp
```

## Dockerでの再ビルド・再起動手順

### モジュールや依存パッケージ、コードの更新を確実に反映するには：

```sh
docker-compose up -d --force-recreate --build app
```
- これにより、appサービスのイメージを再ビルドし、コンテナを強制再作成します。
- `docker-compose restart app` ではコードや依存パッケージの変更が反映されない場合があります。
- 依存パッケージやDockerfile、ソースコードを更新した場合は必ず上記コマンドを使ってください。

## テスト
```sh
npm test         # 単体テスト
npm run test:e2e # E2Eテスト
```

## 類似コード検出 (jscpd)

プロジェクト内の重複コードを検出するには、開発依存をインストールした後、以下を実行します。

```sh
npm install
npm run jscpd
```

出力はコンソールと HTML レポートに出力されます（デフォルト: `jscpd-report.html`）。


## gitlab　設定手順
## gitlabの初期パスワード
/etc/gitlab/initial_root_password の中に初期パスワードがあります。

## Add new application
1. open Add new application page
http://gitlab.localhost:8929/admin/applications/new

- Name:file-explorer-webapp
- Redirect URI:
 - http://localhost:3000/test/auth/callback
 - http://a.localhost:3000/test/auth/callback
 - http://b.localhost:3000/test/auth/callback
- Scopes
 - read_user
 - openid
 - profile
 - email
 
2. Save application

3. edit authorization-provider-config.json
- Application ID -> GITLAB_CLIENT_ID
- Secret -> GITLAB_CLIENT_SECRET
- Callback URL -> GITLAB_CALLBACK_URL

4. Continue

5. get my email & edit authorization-config.json
http://gitlab.localhost:8929/-/user_settings/profile
Main settings > Email -> authorization.rules.email

6. restart app
docker-compose up -d --force-recreate --build app