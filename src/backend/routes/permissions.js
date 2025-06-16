import express from "express";
import { getUserPermissions } from "../services/authorizationService.js";
import { accessAuthorizationMiddleware } from "../middlewares/authMiddleware.js"; // 認証＋アクセス権限ミドルウェアに変更

const router = express.Router();

// 指定ROOT_PATHの権限を返すAPI
// GET /api/permissions?rootPathId=xxx
router.get("/", accessAuthorizationMiddleware, (req, res) => {
  // デバッグ用ログ追加
  console.log("[permissions] req.user:", req.user);
  console.log("[permissions] req.session:", req.session);
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
  const rootPathId = req.query.rootPathId;
  console.log("[permissions] email:", email, "rootPathId:", rootPathId);
  if (!email) {
    console.warn("[permissions] email未取得で401");
    return res.status(401).json({ error: "未認証です" });
  }
  if (!rootPathId) return res.status(400).json({ error: "rootPathId必須" });
  try {
    const permissions = getUserPermissions(email, rootPathId);
    res.json({ permissions });
  } catch (e) {
    console.error("[permissions] getUserPermissions例外", e);
    res.status(500).json({ error: "権限取得エラー", detail: e.message });
  }
});

export default router;
