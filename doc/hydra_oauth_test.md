# hydra_oauth_test.md

## 1. hydraコンテナの起動
```powershell
docker-compose up -d hydra
```
- http://localhost:4444/ でhydraのpublicエンドポイントが利用可能
- http://localhost:4445/ でadminエンドポイント

## 2. OAUTHクライアント登録
hydra admin APIでOAUTHクライアントを登録する必要があるのだ。
例：
```powershell
Invoke-WebRequest -Uri "http://localhost:4445/clients" -Method POST -ContentType "application/json" -Body '{
  "client_id": "file-explorer-webapp",
  "client_secret": "secret",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code", "id_token"],
  "redirect_uris": ["http://localhost:3000/auth/callback"],
  "scope": "openid profile email"
}'
```

## 3. .envのOAUTH設定
- GITLAB_CLIENT_ID → file-explorer-webapp
- GITLAB_CLIENT_SECRET → secret
- OAUTH_CALLBACK_URL → http://localhost:3000/auth/callback
- hydra用のissuerやエンドポイントはpassport-gitlab2の代わりにpassport-oauth2等でカスタム対応が必要

## 4. passport.jsの設定変更
- hydraのエンドポイントに合わせてStrategyをpassport-oauth2等で差し替え
- 認証フロー・コールバックURLは同じ

## 5. 動作確認
- http://localhost:3000 でWebアプリにアクセス
- 「hydraでログイン」ボタンから認証フローを確認

---

# 注意
- hydraはデフォルトでconsent/login UIが必要。簡易UIをsrc/frontendに用意するか、hydraのサンプルUIを利用
- hydraのOAUTHクライアント登録はadmin APIで行う
