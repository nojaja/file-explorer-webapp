import express from "express";
import { ensureAuthenticated } from "../middlewares/auth.js";
import { getList } from "../services/listService.js";

const router = express.Router();

// GET /api/list?path=xxx
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const path = req.query.path || "/";
    const list = await getList(path);
    res.json(list);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
