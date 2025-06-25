import fs from "fs/promises";
import path from "path";
import { getRootPathById, getDefaultRootPath } from "./authorizationService.js";

/**
 * 指定されたROOT_PATH IDとパスでファイル一覧を取得
 * @param {string} relPath - 相対パス
 * @param {string} rootPathId - ROOT_PATH ID（省略時はデフォルトROOT_PATH）
 * @returns {Object} - ファイル一覧とパス情報
 */
// --- Functional Domain Modeling 型定義 ---
/** @typedef {string & { readonly brand: 'RelPath' }} RelPath */
/** @typedef {string & { readonly brand: 'RootPathId' }} RootPathId */
/** @typedef {string & { readonly brand: 'AbsPath' }} AbsPath */

/**
 * ファイルエントリ型
 * @typedef {Object} FileEntry
 * @property {string} name
 * @property {'dir'|'file'} type
 * @property {number|undefined} size
 * @property {string} mtime
 * @property {string} path
 */

/**
 * ファイル一覧取得結果型
 * @typedef {Object} ListResult
 * @property {string} path
 * @property {FileEntry[]} files
 * @property {string} rootPathId
 * @property {string} rootPath
 */

/**
 * 成功/失敗を表すResult型
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: Error }} Result
 */

// --- スマートコンストラクタ: パス検証 ---
/**
 * ROOT_PATH配下の安全な絶対パスを生成（パストラバーサル防止）
 * @param {string} ROOT_PATH
 * @param {string} relPath
 * @returns {Result<string>} 絶対パス or エラー
 */
function createAbsPath(ROOT_PATH, relPath) {
  const normalizedRelPath = path.normalize(relPath).replace(/^([/\\])+/, '');
  if (normalizedRelPath.includes('..')) {
    return { ok: false, error: new Error('不正なパス指定です。') };
  }
  const absPath = path.join(ROOT_PATH, normalizedRelPath);
  const resolvedAbsPath = path.resolve(absPath);
  const resolvedRootPath = path.resolve(ROOT_PATH);
  if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
    return { ok: false, error: new Error('不正なパスへのアクセス。') };
  }
  return { ok: true, value: resolvedAbsPath };
}

// --- 純粋関数: ファイルエントリ生成 ---
function toFileEntry(entry, stat, currentRelPath, resolvedAbsPath) {
  return {
    name: entry.name,
    type: entry.isDirectory() ? 'dir' : 'file',
    size: entry.isFile() ? stat.size : undefined,
    mtime: stat.mtime.toISOString(),
    path: path.join(currentRelPath, entry.name)
  };
}

// --- ドメインサービス本体 ---
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
  // パス検証（スマートコンストラクタ）
  const absPathResult = createAbsPath(ROOT_PATH, currentRelPath);
  if (!absPathResult.ok) {
    console.error(`[SECURITY] Attempt to access path outside ROOT_PATH: relPath='${currentRelPath}'`);
    throw absPathResult.error;
  }
  const resolvedAbsPath = absPathResult.value;

  let entries;
  try {
    entries = await fs.readdir(resolvedAbsPath, { withFileTypes: true });
  } catch (err) {
    console.error(`ディレクトリ ${resolvedAbsPath} の読み取りに失敗した: ${err.message}`);
    throw new Error(`ディレクトリ '${currentRelPath}' が見つからないか、アクセスできない。`);
  }
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(resolvedAbsPath, entry.name);
    let stat;
    try {
      stat = await fs.stat(entryPath);
    } catch (e) {
      console.warn(`ファイル/ディレクトリ ${entryPath} の情報取得に失敗し、スキップする: ${e.message}`);
      continue;
    }
    files.push(toFileEntry(entry, stat, currentRelPath, resolvedAbsPath));
  }
  files.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  /** @type {ListResult} */
  const result = {
    path: currentRelPath,
    files,
    rootPathId: rootPathId,
    rootPath: ROOT_PATH
  };
  return result;
}
