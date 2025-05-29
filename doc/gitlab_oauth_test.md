# Gitlab OAUTH認証局の起動・連携手順

## 1. Gitlabコンテナの起動
```powershell
docker-compose up -d gitlab
```
- 初回起動は数分かかるのだ。
- http://localhost:8929 でGitlabにアクセスできるのだ。

## 2. GitlabでOAUTHアプリ登録
1. 管理者でログイン
2. [管理エリア] → [アプリケーション] → [新規アプリケーション]
3. 名前: file-explorer-webapp
4. リダイレクトURI: http://localhost:3000/auth/callback
5. scope: read_user
6. 登録後、Client ID/Secretを.envに転記

## 3. アプリ側の起動
```powershell
docker-compose up -d app
```
- .envのGITLAB_CLIENT_ID/GITLAB_CLIENT_SECRET/OAUTH_CALLBACK_URLを正しく設定

## 4. 動作確認
- http://localhost:3000 でWebアプリにアクセス
- 「Gitlabでログイン」ボタンから認証フローを確認
- 認証後、ファイル操作APIが利用可能になる

## 5. 軽量認証局への切り替え
- ory/hydra等のイメージをdocker-compose.ymlに追加し、同様のOAUTH設定で試験可能
- 切り替え時は.envとpassport設定のOAUTHエンドポイントを変更

---

# 注意
- hostsファイルで gitlab.local → 127.0.0.1 の設定が必要な場合あり
- Windows環境では管理者権限でdocker-composeを実行するのだ
