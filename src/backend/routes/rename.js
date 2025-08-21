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

    _validateRenameInput(filePath, newName, rootPathId);
    await _performRename({ filePath, newName, rootPathId });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function _validateRenameInput(filePath, newName, rootPathId) {
  if (!filePath || !rootPathId) throw new Error("パラメータ不足");
  if (typeof newName !== 'string') throw new Error("パラメータ不足");
  if (!newName.trim()) throw new Error("名前は空にできません");
  if (/[/\\:*?"<>|]/.test(newName)) throw new Error("名前に不正な文字が含まれています");
}

async function _performRename({ filePath, newName, rootPathId }) {
  // ROOT_PATH物理パス取得
  const rootDir = await getRootPathPhysicalDir(rootPathId);
  if (!rootDir) throw new Error("ROOT_PATHが見つかりません");

  // パストラバーサル対策
  const absPath = path.resolve(rootDir, '.' + path.sep + filePath);
  if (!absPath.startsWith(rootDir)) throw new Error("パストラバーサル検出: 不正なパスです");

  // ファイル/ディレクトリの親ディレクトリ取得
  const dir = path.dirname(absPath);
  const newAbsPath = path.join(dir, newName);

  // 重複チェック（fs.access の結果を分離して処理）
  try {
    await fs.access(newAbsPath);
    throw new Error("同名のファイルまたはフォルダが既に存在します");
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      // 存在しない -> 問題なし
    } else if (err && err.message === "同名のファイルまたはフォルダが既に存在します") {
      // 再スロー
      throw err;
    } else if (err) {
      throw err;
    }
  }

  // リネーム実行
  await fs.rename(absPath, newAbsPath);
}

export default router;
