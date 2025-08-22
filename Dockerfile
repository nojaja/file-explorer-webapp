# ---- ビルドステージ ----
FROM node:18.20.7-alpine AS builder
WORKDIR /app
# 設定ファイルと依存関係をコピー
COPY package.json package-lock.json webpack.backend.config.js ./
# ソースコードをコピー
COPY src/ ./src/
COPY conf/ ./conf/
# 依存関係をインストール
# package-lock.json と package.json が同期していない CI 環境向けに
# ビルドでは npm install を使う（最小変更でビルドを通す）
RUN npm install
# pkgとwebpack-cliをグローバルインストール
RUN npm install -g pkg@latest webpack webpack-cli
# バックエンドをビルドしてバンドル（CommonJS）
RUN webpack --config webpack.backend.config.js
# フロントエンドをビルドしてバンドル（UMD）
COPY webpack.frontend.config.js ./
RUN webpack --config webpack.frontend.config.js
# 証明書を追加
RUN apk add --no-cache ca-certificates coreutils

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
COPY --from=builder /app/conf/authorization-provider-config.json /conf/authorization-provider-config.json
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
# dist配下のバンドルをコピー
COPY --from=builder /app/dist/ ./dist/
# フロントエンドのファイルをコピー
COPY --from=builder /app/src/frontend/ ./src/frontend/
# CSSファイルをコピー
COPY --from=builder /app/src/styles/ ./src/styles/
# dfコマンド# ビルダーイメージからdfと依存ライブラリをコピー
COPY --from=builder /bin/df /bin/df
COPY --from=builder /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
COPY --from=builder /lib/libc.musl-x86_64.so.1 /lib/libc.musl-x86_64.so.1
COPY --from=builder /usr/lib/libcrypto.so.3 /usr/lib/libcrypto.so.3
COPY --from=builder /usr/lib/libacl.so.1 /usr/lib/libacl.so.1
COPY --from=builder /usr/lib/libattr.so.1 /usr/lib/libattr.so.1
COPY --from=builder /usr/lib/libutmps.so.0.1 /usr/lib/libutmps.so.0.1
COPY --from=builder /usr/lib/libskarnet.so.2.14 /usr/lib/libskarnet.so.2.14



# ポートを公開
EXPOSE 3000
# エントリポイント
ENTRYPOINT ["./app.bin"]