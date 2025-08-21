import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { getUserPermissions, getRootPathById } from "../services/authorizationService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// helper: リクエストから email を抽出
function _extractEmailFromRequest(req) {
  const user = req.user || req.session?.passport?.user?.profile || req.session?.user;
  if (!user) return req.session?.email || null;
  if (user.profile?.email) return user.profile.email; // Hydra
  if (user.email) return user.email; // GitLab
  if (user.username) return user.username; // その他
  return req.session?.email || null;
}

// helper: パスの検証とディレクトリ作成
async function _prepareTargetDirectory(rootPathId, relPath) {
  const ROOT_PATH = getRootPathById(rootPathId);
  if (!ROOT_PATH) return { error: 'ROOT_PATHが見つかりません' };
  const absBase = path.resolve(ROOT_PATH);
  const absTarget = path.resolve(absBase, relPath.replace(/^([\\/])+/, ''));
  const normBase = path.normalize(absBase).toLowerCase();
  const normTarget = path.normalize(absTarget).toLowerCase();
  if (!normTarget.startsWith(normBase)) return { error: '不正なパス' };
  await fs.mkdir(absTarget, { recursive: true });
  return { absTarget };
}

// ファイルアップロードAPI
router.post('/', upload.array('files'), async (req, res) => {
  try {
    const email = _extractEmailFromRequest(req);
    const rootPathId = req.body.rootPathId;
    if (!email) return res.status(401).json({ error: '未認証です' });
    if (!rootPathId) return res.status(400).json({ error: 'rootPathId必須' });

    const permissions = getUserPermissions(email, rootPathId);
    if (!permissions.canUpload) return res.status(403).json({ error: 'アップロード権限がありません' });

    const relPath = req.body.path || '';
    const prep = await _prepareTargetDirectory(rootPathId, relPath);
    if (prep.error) return res.status(400).json({ error: prep.error });

    const absTarget = prep.absTarget;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'ファイルがありません' });

    for (const file of files) {
      const safeOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const dest = path.join(absTarget, safeOriginalName);
      await fs.writeFile(dest, file.buffer);
      file._safeOriginalName = safeOriginalName;
    }
    res.json({ success: true, uploaded: files.map(f => f._safeOriginalName || f.originalname) });
  } catch (e) {
    console.error('[upload] エラー', e);
    res.status(500).json({ error: 'アップロード失敗' });
  }
});

export default router;
