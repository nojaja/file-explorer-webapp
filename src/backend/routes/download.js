import express from "express";
import { createActionAuthorizationMiddleware } from "../middlewares/authMiddleware.js";
import { downloadFile, downloadFolderZip } from "../services/downloadService.js";

const router = express.Router();

// GET /api/download/file?path=xxx
router.get("/file", createActionAuthorizationMiddleware('download'), downloadFile);

// GET /api/download/folder?path=xxx
router.get("/folder", createActionAuthorizationMiddleware('download'), downloadFolderZip);

export default router;
