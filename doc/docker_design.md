# Docker設計（ファイルエクスプローラWebアプリ）

## 基本方針
- Node.js公式イメージ（18.20.7）をベース
- 必要ファイルのみCOPY
- 環境変数は.envまたはdocker run --env-fileで注入
- ポートは環境変数PORTで指定

## Dockerfile例
```
FROM node:18.20.7
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
CMD ["npm", "start"]
```

## ビルド・起動例
```
docker build -t file-explorer-webapp .
docker run --env-file .env -p 3000:3000 file-explorer-webapp
```

## 注意点
- ROOT_PATH, OAUTH系など全て環境変数で制御
- 永続化が必要な場合は-vでマウント
- 本番運用時は不要ファイル除外（.dockerignore推奨）
