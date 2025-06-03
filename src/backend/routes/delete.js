import express from "express";
import { createActionAuthorizationMiddleware } from "../middlewares/authMiddleware.js";
import { deleteFile } from "../services/deleteService.js";

const router = express.Router();

// DELETE /api/delete/file
router.delete("/file", createActionAuthorizationMiddleware('delete'), deleteFile);

export default router;
