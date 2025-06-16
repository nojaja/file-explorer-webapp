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
