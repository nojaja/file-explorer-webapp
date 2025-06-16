import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { getUserPermissions, getRootPathById } from "../services/authorizationService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ファイルアップロードAPI
router.post("/", upload.array("files"), async (req, res) => {
  try {
    const user = req.user || req.session?.passport?.user?.profile || req.session?.user;
    // 認証局ごとにemail取得ロジックを分岐
    let email = null;
    if (user) {
      if (user.profile && user.profile.email) { // Hydra
        email = user.profile.email;
      } else if (user.email) { // GitLab
        email = user.email;
      } else if (user.username) { // その他
        email = user.username;
      } else if (req.session?.email) {
        email = req.session.email;
      }
    }
    const rootPathId = req.body.rootPathId;
    // relPathの先頭のスラッシュやバックスラッシュを除去
    let relPath = req.body.path || "";
    relPath = relPath.replace(/^([\\/])+/, "");
    if (!email) return res.status(401).json({ error: "未認証です" });
    if (!rootPathId) return res.status(400).json({ error: "rootPathId必須" });
    const permissions = getUserPermissions(email, rootPathId);
    if (!permissions.canUpload) return res.status(403).json({ error: "アップロード権限がありません" });
    const ROOT_PATH = getRootPathById(rootPathId);
    if (!ROOT_PATH) return res.status(400).json({ error: "ROOT_PATHが見つかりません" });
    const absBase = path.resolve(ROOT_PATH);
    const absTarget = path.resolve(absBase, relPath);
    // Windows対応: normalizeして小文字比較
    const normBase = path.normalize(absBase).toLowerCase();
    const normTarget = path.normalize(absTarget).toLowerCase();
    if (!normTarget.startsWith(normBase)) return res.status(403).json({ error: "不正なパス" });
    await fs.mkdir(absTarget, { recursive: true });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "ファイルがありません" });
    for (const file of files) {
      // ファイル名の文字化け対策: latin1→utf8変換
      const safeOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const dest = path.join(absTarget, safeOriginalName);
      await fs.writeFile(dest, file.buffer);
      file._safeOriginalName = safeOriginalName; // レスポンス用に保持
    }
    res.json({ success: true, uploaded: files.map(f => f._safeOriginalName || f.originalname) });
  } catch (e) {
    console.error("[upload] エラー", e);
    res.status(500).json({ error: "アップロード失敗" });
  }
});

export default router;
