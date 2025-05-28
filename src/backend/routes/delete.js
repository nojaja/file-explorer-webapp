import express from "express";
import { ensureAuthenticated } from "../middlewares/auth.js";
import { deleteFile, deleteFolder } from "../services/deleteService.js";

const router = express.Router();

// DELETE /api/delete/file
router.delete("/file", ensureAuthenticated, deleteFile);

// DELETE /api/delete/folder
router.delete("/folder", ensureAuthenticated, deleteFolder);

export default router;
