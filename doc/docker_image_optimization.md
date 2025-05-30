# Node.jsアプリのDockerイメージ最小化手順

この記事は「A Step-by-Step Guide to Docker Image Optimisation」(Prateek Jain)を参考に、Node.jsアプリを最小のDockerイメージで実行するための手順をまとめたものなのだ。

---

## 1. .dockerignoreの作成
不要なファイル・フォルダをイメージに含めないよう、プロジェクトルートに`.dockerignore`を用意するのだ。

```text
node_modules
npm-debug.log
Dockerfile*
docker-compose.yml
.git
.gitignore
test
coverage
docs
*.md
```

---

## 2. マルチステージビルドの活用
ビルド用ステージとランタイム用ステージを分離するのだ。

- **ビルドステージ**: 依存関係のインストール、ビルド
- **ランタイムステージ**: 最小限の実行環境のみを含む

---

## 3. 依存関係の効率的なインストール

- `package.json`と`package-lock.json`を先にコピーして`npm ci`を実行し、キャッシュを活用するのだ。
- ビルドステージでは`devDependencies`を含めて、ランタイムステージでは`production`のみを残す。

---

## 4. 軽量なベースイメージの選択

- `node:18-alpine`や`node:18-slim`を検討するのだ。
- さらなるサイズ削減にはGoogleのDistrolessイメージ（`gcr.io/distroless/nodejs:18`など）を利用するのだ。

---

## 5. キャッシュとレイヤー最適化

- `COPY`と`RUN`命令の順序を工夫してキャッシュヒット率を高めるのだ。
- 不要なファイルは早期に除外して、レイヤーサイズを抑える。

---

## 6. 静的バイナリ方式の採用
Node.jsアプリを静的バイナリ化し、最小のイメージで実行するのだ。

1. `pkg`をインストールして実行ファイルを生成
   ```powershell
   npm install -g pkg
   pkg . --targets node18-linux-x64 --output app.bin
   ```
2. 静的バイナリを`scratch`イメージで実行

### サンプルDockerfile (静的バイナリ方式)
```dockerfile
# ---- ビルドステージ ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
# 静的バイナリ生成
RUN npm install -g pkg \
    ; pkg . --targets node18-linux-x64 --output app.bin

# ---- ランタイムステージ ----
FROM scratch
# 実行ファイルをコピー
COPY --from=builder /app/app.bin /app/app.bin
# 必要に応じて証明書をコピー
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENTRYPOINT ["/app/app.bin"]
```

### トラブルシューティングと注意点

- **`pkg` のターゲット指定**: `pkg` でバイナリを生成する際、ランタイムステージで使用するベースイメージと互換性のあるターゲットを指定することが非常に重要です。例えば、ランタイムイメージに `node:18-alpine` を使用する場合、ビルドステージの `pkg` コマンドでは `--targets node18-alpine-x64` のように Alpine Linux 向けのターゲットを指定する必要があります。指定が異なると、`exec ./app: no such file or directory` や `exec /app.bin: no such file or directory` といったエラーが発生する可能性があります。これは、バイナリが必要とする動的ライブラリがランタイム環境に存在しないために起こることが多いです。
- **`WORKDIR` と `ENTRYPOINT`/`CMD` のパス**: `WORKDIR` で指定したディレクトリは、それ以降の `RUN`, `CMD`, `ENTRYPOINT`, `COPY`, `ADD` 命令の基準ディレクトリとなります。`ENTRYPOINT` や `CMD` で実行ファイルを指定する際は、`WORKDIR` からの相対パス（例: `["./app.bin"]`）または絶対パス（例: `["/app/app.bin"]`）で正しく指定してください。パスの不一致は `no such file or directory` エラーの原因となります。
- **デバッグ時のファイル確認**: Dockerfile のビルド中にファイルが期待通りに配置されているか、パーミッションは適切かなどを確認するために、各ステージで `RUN ls -la /app` のようなデバッグコマンドを一時的に追加すると問題解決に役立ちます。
- **ベースイメージの選択**: `gcr.io/distroless/static:nonroot` のような超軽量イメージは魅力的ですが、デバッグが難しかったり、特定のライブラリが不足していたりする場合があります。問題が発生した場合は、`node:18-alpine` のような、より多くのツールやライブラリを含む軽量イメージに切り替えてみるのも一つの解決策です。
    - `gcr.io/distroless/static:nonroot` や `scratch` をランタイムイメージとして使用する場合、`pkg` のターゲットは `nodeXX-linuxstatic-x64` (XXはNode.jsのバージョン) のように、静的リンクされるターゲットを指定する必要があります。これにより、ランタイム環境にlibcなどの共有ライブラリが存在しない場合でもバイナリが実行可能になります。`scratch` イメージの場合は、`ca-certificates` など、アプリケーションが必要とする可能性のあるファイルも忘れずにコピーしてください。

---

## 7. イメージのビルドと検証 (静的バイナリ方式)
```powershell
# イメージビルド
docker build -t myapp:static .
# サイズ確認
docker images myapp:static
# コンテナ起動テスト
docker run --rm -p 3000:3000 myapp:static
```

以上で静的バイナリ方式による最小イメージが完成するのだ。
