import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { getRootPathById, getDefaultRootPath } from "./authorizationService.js";

// --- パストラバーサル対策付きスマートコンストラクタ ---
/**
 * ROOT_PATH配下の安全な絶対パスを生成（パストラバーサル防止）
 * @param {string} ROOT_PATH
 * @param {string} relPath
 * @returns {Result<string>} 絶対パス or エラー
 */
function createAbsPath(ROOT_PATH, relPath) {
  if (typeof relPath !== 'string' || relPath.includes('..') || relPath.startsWith('/') || /^[a-zA-Z]:\\/.test(relPath)) {
    return { ok: false, error: new Error('不正なパス指定です。') };
  }
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

export async function deleteFile(req, res) {
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
    
    console.log(`[DeleteService] ROOT_PATH: ${ROOT_PATH}, rootPathId: ${targetRootPathId}, relPath: ${relPath}`);
    
    const absPathResult = createAbsPath(ROOT_PATH, relPath);
    if (!absPathResult.ok) {
      return res.status(403).json({ error: absPathResult.error.message });
    }
    const absPath = absPathResult.value;
    
    if (!fsSync.existsSync(absPath)) return res.status(404).json({ error: "対象が存在しません" });
    //フォルダかどうかをチェック
    if (fsSync.lstatSync(absPath).isDirectory()) {
      await fs.rm(absPath, { recursive: true, force: true });
    } else {
      await fs.unlink(absPath);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("ファイル削除中にエラー:", error);
    return res.status(500).json({ error: "ファイル削除中にエラーが発生しました。" });
  }
}
