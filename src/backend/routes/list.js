import express from "express";
import { accessAuthorizationMiddleware } from "../middlewares/authMiddleware.js";
import { getList } from "../services/listService.js";

const router = express.Router();

// GET /api/list?path=xxx&rootPathId=xxx
router.get("/", accessAuthorizationMiddleware, async (req, res) => {
  try {
    const path = req.query.path || "/";
    const rootPathId = req.query.rootPathId || req.session?.selectedRootPathId;
    
    console.log(`[List API] リクエスト: path=${path}, rootPathId=${rootPathId}, session=${req.session?.selectedRootPathId}`);
    
    const list = await getList(path, rootPathId);
    res.json(list);
  } catch (e) {
    console.error('[List API] エラー:', e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
