# ---- ビルドステージ ----
FROM node:18.20.7-alpine AS builder
WORKDIR /app
# 設定ファイルと依存関係をコピー
COPY package.json package-lock.json webpack.backend.config.js ./
# ソースコードをコピー
COPY src/ ./src/
COPY conf/ ./conf/
# 依存関係をインストール
RUN npm ci
# pkgとwebpack-cliをグローバルインストール
RUN npm install -g pkg@latest webpack webpack-cli
# バックエンドをビルドしてバンドル（CommonJS）
RUN webpack --config webpack.backend.config.js
# フロントエンドをビルドしてバンドル（UMD）
COPY webpack.frontend.config.js ./
RUN webpack --config webpack.frontend.config.js
# 証明書を追加
RUN apk add --no-cache ca-certificates
# 静的バイナリを生成
#RUN pkg build/bundle.js --targets node18-alpine-x64 --output app.bin
RUN pkg build/bundle.js --targets node18-linuxstatic-x64 --output app.bin

# /app ディレクトリの内容を確認
#RUN ls -la /app

# ---- ランタイムステージ ----
FROM scratch
WORKDIR /app
# バイナリと証明書をコピー
COPY --from=builder /app/app.bin /app/app.bin
COPY --from=builder /app/conf/authorization-config.json /conf/authorization-config.json
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
# dist配下のバンドルをコピー
COPY --from=builder /app/dist/ ./dist/
# フロントエンドのファイルをコピー
COPY --from=builder /app/src/frontend/ ./src/frontend/
# CSSファイルをコピー
COPY --from=builder /app/src/styles/ ./src/styles/

# ポートを公開
EXPOSE 3000
# エントリポイント
ENTRYPOINT ["./app.bin"]
