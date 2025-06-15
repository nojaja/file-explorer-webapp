import fs from "fs/promises";
import path from "path";
import { getRootPathById, getDefaultRootPath } from "./authorizationService.js";

/**
 * 指定されたROOT_PATH IDとパスでファイル一覧を取得
 * @param {string} relPath - 相対パス
 * @param {string} rootPathId - ROOT_PATH ID（省略時はデフォルトROOT_PATH）
 * @returns {Object} - ファイル一覧とパス情報
 */
export async function getList(relPath, rootPathId = null) {
  // ROOT_PATH IDが指定されていない場合はデフォルトを使用
  if (!rootPathId) {
    const defaultRootPath = getDefaultRootPath();
    rootPathId = defaultRootPath ? defaultRootPath.id : null;
  }
  
  if (!rootPathId) {
    throw new Error("ROOT_PATHが設定されていません");
  }
  
  // ROOT_PATH IDから実際のパスを取得
  const ROOT_PATH = getRootPathById(rootPathId);
  if (!ROOT_PATH) {
    throw new Error(`ROOT_PATH ID '${rootPathId}' が見つかりません`);
  }
  
  console.log(`[ListService] ROOT_PATH: ${ROOT_PATH}, rootPathId: ${rootPathId}, relPath: ${relPath}`);
  
  // relPath が undefined や null の場合を考慮して、空文字列にフォールバックする
  const currentRelPath = relPath || "";
  const absPath = path.join(ROOT_PATH, currentRelPath);

  // パストラバーサル攻撃の基本的な対策
  // path.resolve を使って正規化し、それが ROOT_PATH の内部であることを確認する
  const resolvedAbsPath = path.resolve(absPath);
  const resolvedRootPath = path.resolve(ROOT_PATH);

  if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
    console.error(
      `[SECURITY] Attempt to access path outside ROOT_PATH: relPath='${currentRelPath}', resolvedAbsPath='${resolvedAbsPath}', resolvedRootPath='${resolvedRootPath}'`
    );
    // 適切なエラーレスポンスを返すか、エラーを投げる
    const err = new Error("不正なパスへのアクセス。");
    // err.status = 403; // HTTPステータスコードを設定できるとより良い
    throw err;
  }

  let entries;
  try {
    entries = await fs.readdir(resolvedAbsPath, { withFileTypes: true });
  } catch (err) {
    // readdir でエラーが発生した場合 (例: パスが存在しない、アクセス権がない)
    console.error(`ディレクトリ ${resolvedAbsPath} の読み取りに失敗した: ${err.message}`);
    // エラーを投げるか、空のリストを返すか。
    const newErr = new Error(`ディレクトリ '${currentRelPath}' が見つからないか、アクセスできない。`);
    // newErr.status = 404;
    throw newErr;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(resolvedAbsPath, entry.name);
    let stat;
    try {
      stat = await fs.stat(entryPath);
    } catch (e) {
      // stat でエラーが発生した場合 (例: シンボリックリンクが切れている、アクセス権がない)
      // これをログに出力することで、何がスキップされたか追跡しやすくなる。
      console.warn(`ファイル/ディレクトリ ${entryPath} の情報取得に失敗し、スキップする: ${e.message}`);
      continue; // アクセスできないファイルはスキップ
    }
    files.push({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
      size: entry.isFile() ? stat.size : undefined,
      mtime: stat.mtime.toISOString(),
      // currentRelPath と entry.name を結合して、このエントリの相対パスを生成する
      path: path.join(currentRelPath, entry.name)
    });
  }
  files.sort((a, b) => {
    // ディレクトリを先、名前順
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });  // 返すパスは、入力された relPath (または空文字列) をそのまま使う
  return { 
    path: currentRelPath, 
    files,
    rootPathId: rootPathId,
    rootPath: ROOT_PATH
  };
}
