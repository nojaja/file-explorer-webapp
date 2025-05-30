import path from "path";
import fsSync from "fs";
import archiver from "archiver";
const ROOT_PATH = process.env.ROOT_PATH || "./data";

export async function downloadFile(req, res) {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: "path必須" });
    const absPath = path.join(ROOT_PATH, relPath);
    // パストラバーサル攻撃の基本的な対策
    const resolvedAbsPath = path.resolve(absPath);
    const resolvedRootPath = path.resolve(ROOT_PATH);
    if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
      console.error(`[SECURITY] 不正なパスへのアクセス: relPath='${relPath}'`);
      return res.status(403).json({ error: "不正なパスへのアクセス。" });
    }
    // ファイルの存在チェック
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
  } catch (error) {
    console.error("ファイルダウンロード中にエラー:", error);
    return res.status(500).json({ error: "ファイルダウンロード中にエラーが発生しました。" });

  }
}

export async function downloadFolderZip(req, res) {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: "path必須" });
    const absPath = path.join(ROOT_PATH, relPath);
    // パストラバーサル攻撃の基本的な対策
    const resolvedAbsPath = path.resolve(absPath);
    const resolvedRootPath = path.resolve(ROOT_PATH);
    if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
      console.error(`[SECURITY] 不正なパスへのアクセス: relPath='${relPath}'`);
      return res.status(403).json({ error: "不正なパスへのアクセス。" });
    }
    if (!fsSync.existsSync(absPath)) return res.status(404).json({ error: "フォルダが存在しません" });
    res.setHeader("Content-Type", "application/zip");
    const fileName = encodeURIComponent(path.basename(relPath));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}.zip`);
    console.log(`フォルダのZIPダウンロード: ${absPath} filename="${path.basename(relPath)}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.directory(absPath, false);
    archive.finalize();
    archive.pipe(res);

  } catch (error) {
    console.error("フォルダのZIPダウンロード中にエラー:", error);
    res.status(500).json({ error: "フォルダのZIPダウンロード中にエラーが発生しました。" });
  }
}
