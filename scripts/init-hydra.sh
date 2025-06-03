#!/bin/bash
# Hydra初期化スクリプト

echo "Hydraサーバーの起動を待機中..."

# Hydraサーバーが起動するまで待機
while ! curl -f http://hydra:4445/health/ready 2>/dev/null; do
    echo "Hydraサーバーの起動を待機中..."
    sleep 2
done

echo "Hydraサーバーが起動しました。OAuthクライアントを作成します..."

# 既存のクライアントをチェック（エラーを無視）
CLIENT_EXISTS=$(hydra list clients --endpoint http://hydra:4445 --format json 2>/dev/null | grep "70b01875-af94-499f-aa7c-ff63b71d7f4e" || echo "")

if [ -z "$CLIENT_EXISTS" ]; then
    echo "OAuthクライアントを作成中..."
    hydra create client \
        --endpoint http://hydra:4445 \
        --id 70b01875-af94-499f-aa7c-ff63b71d7f4e \
        --secret secret \
        --grant-types authorization_code,refresh_token \
        --response-types code \
        --scope openid,profile,email \
        --callbacks http://localhost:3000/auth/callback \
        --token-endpoint-auth-method client_secret_post
    
    if [ $? -eq 0 ]; then
        echo "OAuthクライアントが正常に作成されました！"
    else
        echo "OAuthクライアントの作成に失敗しました"
        exit 1
    fi
else
    echo "OAuthクライアントは既に存在します"
fi

echo "Hydra初期化が完了しました！"

echo "========================"
echo "テストユーザー情報:"
echo "ユーザー名: testuser"
echo "Email: testuser@example.com"
echo "========================"
echo "ログイン時に上記の情報を使用してください。"
