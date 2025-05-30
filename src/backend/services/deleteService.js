import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
const ROOT_PATH = process.env.ROOT_PATH || "/data";

export async function deleteFile(req, res) {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: "path必須" });
    const absPath = path.join(ROOT_PATH, relPath);
    // パストラバーサル攻撃の基本的な対策
    const resolvedAbsPath = path.resolve(absPath);
    const resolvedRootPath = path.resolve(ROOT_PATH);
    if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
      console.error(`[SECURITY] 不正なパスへのアクセス: relPath='${relPath}'`);
      return res.status(403).json({ error: "不正なパスへのアクセス。" });
    }

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
