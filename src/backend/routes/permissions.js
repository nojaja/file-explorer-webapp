import express from "express";
import { getUserPermissions } from "../services/authorizationService.js";
import { accessAuthorizationMiddleware } from "../middlewares/authMiddleware.js"; // 認証＋アクセス権限ミドルウェアに変更

const router = express.Router();

// helper: リクエストから email を抽出
function _extractEmailFromRequest(req) {
  const user = req.user || req.session?.passport?.user?.profile || req.session?.user;
  if (!user) return req.session?.email || null;
  if (user.profile?.email) return user.profile.email; // Hydra
  if (user.email) return user.email; // GitLab
  if (user.username) return user.username; // その他
  return req.session?.email || null;
}

// 指定ROOT_PATHの権限を返すAPI
// GET /api/permissions?rootPathId=xxx
router.get('/', accessAuthorizationMiddleware, (req, res) => {
  console.log('[permissions] req.user:', req.user);
  console.log('[permissions] req.session:', req.session);

  const email = _extractEmailFromRequest(req);
  const rootPathId = req.query.rootPathId;
  console.log('[permissions] email:', email, 'rootPathId:', rootPathId);

  if (!email) {
    console.warn('[permissions] email未取得で401');
    return res.status(401).json({ error: '未認証です' });
  }

  if (!rootPathId) return res.status(400).json({ error: 'rootPathId必須' });

  try {
    const permissions = getUserPermissions(email, rootPathId);
    res.json({ permissions });
  } catch (e) {
    console.error('[permissions] getUserPermissions例外', e);
    res.status(500).json({ error: '権限取得エラー', detail: e.message });
  }
});

export default router;
