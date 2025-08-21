import path from "path";
import fsSync from "fs";
import archiver from "archiver";
import { getRootPathById, getDefaultRootPath } from "./authorizationService.js";

// --- Functional Domain Modeling 型定義 ---
/** @typedef {string & { readonly brand: 'RelPath' }} RelPath */
/** @typedef {string & { readonly brand: 'RootPathId' }} RootPathId */
/** @typedef {string & { readonly brand: 'AbsPath' }} AbsPath */
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

export async function downloadFile(req, res) {
  try {
    const relPath = req.query.path;
    const rootPathId = req.query.rootPathId || req.session?.selectedRootPathId;
    
    if (!relPath) return res.status(400).json({ error: "path必須" });
    
    // ROOT_PATH IDが指定されていない場合はデフォルトを使用
    let targetRootPathId = rootPathId;
    if (!targetRootPathId) {
      const defaultRootPath = getDefaultRootPath();
      targetRootPathId = defaultRootPath ? defaultRootPath.id : null;
    }
    
    if (!targetRootPathId) {
      return res.status(400).json({ error: "ROOT_PATHが設定されていません。" });
    }
    
    // ROOT_PATH IDから実際のパスを取得
    const ROOT_PATH = getRootPathById(targetRootPathId);
    if (!ROOT_PATH) {
      return res.status(400).json({ error: `ROOT_PATH ID '${targetRootPathId}' が見つかりません。` });
    }
    
    console.log(`[DownloadService] ROOT_PATH: ${ROOT_PATH}, rootPathId: ${targetRootPathId}, relPath: ${relPath}`);
    
    const absPathResult = createAbsPath(ROOT_PATH, relPath);
    if (!absPathResult.ok) {
      return res.status(403).json({ error: absPathResult.error.message });
    }
    const resolvedAbsPath = absPathResult.value;
    
    // ファイルの存在チェック
    if (!fsSync.existsSync(resolvedAbsPath)) return res.status(404).json({ error: "ファイルが存在しません" });
    // Content-Dispositionヘッダーを明示的に付与し、ファイル名を安全にエンコード
    const fileName = encodeURIComponent(path.basename(relPath));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
    res.setHeader("Content-Type", "application/octet-stream");
    // ファイルストリームをpipe
    const stream = fsSync.createReadStream(resolvedAbsPath);
    stream.pipe(res);
    stream.on('error', (error) => {
      console.error("ファイル読み込みエラー:", error);
      res.status(500).end("ファイル読み込みエラー");
    });
  } catch (error) {
    console.error("ファイルダウンロード中にエラー:", error);
    return res.status(500).json({ error: "ファイルダウンロード中にエラーが発生しました。" });

  }
}

export async function downloadFolderZip(req, res) {
  try {
    const relPath = req.query.path;
    const rootPathId = req.query.rootPathId || req.session?.selectedRootPathId;
    
    if (!relPath) return res.status(400).json({ error: "path必須" });
    
    // ROOT_PATH IDが指定されていない場合はデフォルトを使用
    let targetRootPathId = rootPathId;
    if (!targetRootPathId) {
      const defaultRootPath = getDefaultRootPath();
      targetRootPathId = defaultRootPath ? defaultRootPath.id : null;
    }
    
    if (!targetRootPathId) {
      return res.status(400).json({ error: "ROOT_PATHが設定されていません。" });
    }
    
    // ROOT_PATH IDから実際のパスを取得
    const ROOT_PATH = getRootPathById(targetRootPathId);
    if (!ROOT_PATH) {
      return res.status(400).json({ error: `ROOT_PATH ID '${targetRootPathId}' が見つかりません。` });
    }
    
    console.log(`[DownloadService] Folder ZIP: ROOT_PATH=${ROOT_PATH}, rootPathId=${targetRootPathId}, relPath=${relPath}`);
    
    const absPathResult = createAbsPath(ROOT_PATH, relPath);
    if (!absPathResult.ok) {
      return res.status(403).json({ error: absPathResult.error.message });
    }
    const resolvedAbsPath = absPathResult.value;
    
    if (!fsSync.existsSync(resolvedAbsPath)) return res.status(404).json({ error: "フォルダが存在しません" });
    res.setHeader("Content-Type", "application/zip");
    const fileName = encodeURIComponent(path.basename(relPath));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}.zip`);
    console.log(`フォルダのZIPダウンロード: ${resolvedAbsPath} filename="${path.basename(relPath)}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.directory(resolvedAbsPath, false);
    archive.finalize();
    archive.pipe(res);

  } catch (error) {
    console.error("フォルダのZIPダウンロード中にエラー:", error);
    res.status(500).json({ error: "フォルダのZIPダウンロード中にエラーが発生しました。" });
  }
}
