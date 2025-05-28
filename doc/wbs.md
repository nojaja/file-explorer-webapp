# WBS（Work Breakdown Structure）

## 1. 仕様・設計
- [x] 1.1 要件定義・仕様書作成（spec.md）
- [x] 1.2 WBS作成（wbs.md）
- [x] 1.3 ディレクトリ・初期ファイル構成設計
- [x] 1.4 API設計
- [x] 1.5 UI設計
- [x] 1.6 Docker設計

## 2. バックエンド実装
- [x] 2.1 Node.jsプロジェクト初期化（package.json, npm設定）
- [x] 2.2 APIサーバ実装（ESM構文）
  - [x] 2.2.1 ファイル・フォルダ一覧取得API
  - [x] 2.2.2 ファイルダウンロードAPI
  - [x] 2.2.3 フォルダzipダウンロードAPI（stream対応）
  - [x] 2.2.4 ファイル/フォルダ完全削除API
- [x] 2.3 OAUTH認証実装（passport.js, Ory Hydra）
  - [x] 2.3.1 Gitlab公式Dockerイメージで認証局を稼働し、OAUTH連携試験
  - [x] 2.3.2 認証局連携試験後、軽量な認証局コンテナ（例：ory/hydra等）での試験に切り替え可能な構成にする
  - [x] 2.3.3 ブラウザ・サーバー間のURL使い分け対応（hydra:4444 vs localhost:4444）
  - [x] 2.3.4 OAuth2Strategy設定（passport-oauth2）
  - [x] 2.3.5 認証ルート実装（/auth/login, /auth/consent, /auth/callback）
  - [x] 2.3.6 CSRFエラー「No CSRF value available in the session cookie」修正
  - [x] 2.3.7 セッション管理とHydraクライアント登録
  - [x] 2.3.8 OAuth認証フロー完全動作確認（Token取得まで）
- [x] 2.4 環境変数対応
- [x] 2.5 ログ・エラーハンドリング

## 3. フロントエンド実装
- [x] 3.1 HTML+JS UI実装
  - [x] 3.1.1 一覧表示（テーブル/リスト）
  - [x] 3.1.2 アイコン・操作ボタン配置
  - [x] 3.1.3 ダウンロード・削除・遷移UI
  - [x] 3.1.4 削除確認ダイアログ・エラー表示
- [x] 3.2 fetchによるAPI連携
- [x] 3.3 日本語UI・Material Design風スタイル

## 4. Docker対応
- [x] 4.1 Dockerfile作成
- [x] 4.2 環境変数設計・反映
- [x] 4.3 動作検証

## 5. テスト
- [x] 5.1 JestによるAPI・ロジック単体テスト
- [x] 5.2 PlaywrightによるUI E2Eテスト

## 6. ドキュメント
- [x] 6.1 README.md作成
- [x] 6.2 使用方法・環境変数・Docker手順記載

## 7. 今後の拡張（任意）
- [ ] 7.1 OAuth認証後の機能統合
  - [ ] 7.1.1 ユーザー情報取得機能実装
  - [ ] 7.1.2 認証状態チェックミドルウェア
  - [ ] 7.1.3 ファイル操作権限管理
- [ ] 7.2 ファイルアップロード
- [ ] 7.3 フォルダ作成
- [ ] 7.4 ファイル名変更
- [ ] 7.5 セキュリティ強化
  - [ ] 7.5.1 HTTPS設定
  - [ ] 7.5.2 追加のCSRF保護
  - [ ] 7.5.3 セッションセキュリティ強化
