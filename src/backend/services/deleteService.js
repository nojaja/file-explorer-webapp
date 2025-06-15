import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { getRootPathById, getDefaultRootPath } from "./authorizationService.js";

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
    
    const absPath = path.join(ROOT_PATH, relPath);
    // パストラバーサル攻撃の基本的な対策
    const resolvedAbsPath = path.resolve(absPath);
    const resolvedRootPath = path.resolve(ROOT_PATH);
    if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
      console.error(`[SECURITY] 不正なパスへのアクセス: relPath='${relPath}'`);
      return res.status(403).json({ error: "不正なパスへのアクセス。" });
    }    if (!fsSync.existsSync(resolvedAbsPath)) return res.status(404).json({ error: "対象が存在しません" });
    //フォルダかどうかをチェック
    if (fsSync.lstatSync(resolvedAbsPath).isDirectory()) {
      await fs.rm(resolvedAbsPath, { recursive: true, force: true });
    } else {
      await fs.unlink(resolvedAbsPath);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("ファイル削除中にエラー:", error);
    return res.status(500).json({ error: "ファイル削除中にエラーが発生しました。" });
  }
}
