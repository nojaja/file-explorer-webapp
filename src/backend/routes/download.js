import express from "express";
import { ensureAuthenticated } from "../middlewares/auth.js";
import { downloadFile, downloadFolderZip } from "../services/downloadService.js";

const router = express.Router();

// GET /api/download/file?path=xxx
router.get("/file", ensureAuthenticated, downloadFile);

// GET /api/download/folder?path=xxx
router.get("/folder", ensureAuthenticated, downloadFolderZip);

export default router;
