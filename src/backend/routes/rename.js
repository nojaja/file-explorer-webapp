import express from "express";
import path from "path";
import fs from "fs/promises";
import { accessAuthorizationMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /api/rename
import { getRootPathPhysicalDir } from "../services/listService.js";
router.post("/", accessAuthorizationMiddleware, async (req, res) => {
  try {
    const { path: filePath, newName, rootPathId } = req.body;
    console.log(`[RENAME API] body:`, req.body);
    if (!filePath || !newName || !rootPathId) throw new Error("パラメータ不足");
    if (/[/\\:*?"<>|]/.test(newName)) throw new Error("名前に不正な文字が含まれています");
    if (!newName.trim()) throw new Error("名前は空にできません");
    // ROOT_PATH物理パス取得
    const rootDir = await getRootPathPhysicalDir(rootPathId);
    if (!rootDir) throw new Error("ROOT_PATHが見つかりません");
    // パストラバーサル対策
    const absPath = path.resolve(rootDir, '.' + path.sep + filePath);
    if (!absPath.startsWith(rootDir)) throw new Error("パストラバーサル検出: 不正なパスです");
    // ファイル/ディレクトリの親ディレクトリ取得
    const dir = path.dirname(absPath);
    const newAbsPath = path.join(dir, newName);
    // 重複チェック（ファイル・ディレクトリ共通）
    try {
      await fs.access(newAbsPath);
      throw new Error("同名のファイルまたはフォルダが既に存在します");
    } catch {}
    // ファイル/ディレクトリのリネーム
    await fs.rename(absPath, newAbsPath);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
