import { AuthManager } from './auth.js';
import { FileManager } from './file.js';

let authManager = null;
let fileManager = null;

/**
 * グローバル関数をexportして、HTMLからの呼び出しを可能にする
 */
export function exportGlobalFunctions() {
  // インスタンスの初期化
  if (!authManager) authManager = new AuthManager();
  if (!fileManager) fileManager = new FileManager();

  // ROOT_PATH選択
  window.selectRootPath = async function(rootPathId) {
    return await fileManager.selectRootPath(rootPathId);
  };

  // ディレクトリ遷移
  window.changeDir = async function(path) {
    return await fileManager.changeDir(path);
  };

  // ファイル削除
  window.deleteFile = async function(path) {
    return await fileManager.deleteFile(path);
  };

  // ログアウト
  window.logout = async function() {
    return await authManager.logout();
  };

  // 認証状態更新
  window.updateLoginStatus = async function() {
    return await authManager.updateLoginStatus();
  };

  // ファイル一覧取得
  window.fetchFiles = async function(path) {
    return await fileManager.fetchFiles(path);
  };

  // ROOT_PATH一覧取得
  window.fetchRootPaths = async function() {
    return await fileManager.fetchRootPaths();
  };

  // アップロード領域表示制御
  window.updateUploadAreaVisibility = function() {
    return fileManager.updateUploadAreaVisibility();
  };

  // アップロード処理
  window.handleUpload = async function(files) {
    return await fileManager.handleUpload(files);
  };

  console.log('[Global] グローバル関数の公開完了');
}
