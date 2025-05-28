import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
const ROOT_PATH = process.env.ROOT_PATH || "/data";

export async function deleteFile(req, res) {
  const relPath = req.body.path;
  if (!relPath) return res.status(400).json({ error: "path必須" });
  const absPath = path.join(ROOT_PATH, relPath);
  if (!fsSync.existsSync(absPath)) return res.status(404).json({ error: "ファイルが存在しません" });
  await fs.unlink(absPath);
  res.json({ success: true });
}

export async function deleteFolder(req, res) {
  const relPath = req.body.path;
  if (!relPath) return res.status(400).json({ error: "path必須" });
  const absPath = path.join(ROOT_PATH, relPath);
  if (!fsSync.existsSync(absPath)) return res.status(404).json({ error: "フォルダが存在しません" });
  await fs.rm(absPath, { recursive: true, force: true });
  res.json({ success: true });
}
