import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import archiver from "archiver";
const ROOT_PATH = process.env.ROOT_PATH || "./data";

export async function downloadFile(req, res) {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: "path必須" });
  const absPath = path.join(ROOT_PATH, relPath);
  if (!fsSync.existsSync(absPath)) return res.status(404).json({ error: "ファイルが存在しません" });
  // Content-Dispositionヘッダーを明示的に付与し、ファイル名を安全にエンコード
  const fileName = encodeURIComponent(path.basename(relPath));
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
  res.setHeader("Content-Type", "application/octet-stream");
  // ファイルストリームをpipe
  const stream = fsSync.createReadStream(absPath);
  stream.pipe(res);
  stream.on('error', err => {
    res.status(500).end("ファイル読み込みエラー");
  });
}

export async function downloadFolderZip(req, res) {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: "path必須" });
  const absPath = path.join(ROOT_PATH, relPath);
  if (!fsSync.existsSync(absPath)) return res.status(404).json({ error: "フォルダが存在しません" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(relPath)}.zip"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.directory(absPath, false);
  archive.finalize();
  archive.pipe(res);
}
