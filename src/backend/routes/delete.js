import express from "express";
import { ensureAuthenticated } from "../middlewares/auth.js";
import { deleteFile, deleteFolder } from "../services/deleteService.js";

const router = express.Router();

// DELETE /api/delete/file
router.delete("/file", ensureAuthenticated, deleteFile);

export default router;
