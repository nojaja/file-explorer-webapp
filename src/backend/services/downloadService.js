import path from "path";
import fsSync from "fs";
import archiver from "archiver";
import { getRootPathById, getDefaultRootPath } from "./authorizationService.js";

export async function downloadFile(req, res) {
  try {
    const relPath = req.query.path;
    const rootPathId = req.query.rootPathId || req.session?.selectedRootPathId;
    
    if (!relPath) return res.status(400).json({ error: "path必須" });
    
    // ROOT_PATH IDが指定されていない場合はデフォルトを使用
    let targetRootPathId = rootPathId;
    if (!targetRootPathId) {
      const defaultRootPath = getDefaultRootPath();
      targetRootPathId = defaultRootPath ? defaultRootPath.id : null;
    }
    
    if (!targetRootPathId) {
      return res.status(400).json({ error: "ROOT_PATHが設定されていません。" });
    }
    
    // ROOT_PATH IDから実際のパスを取得
    const ROOT_PATH = getRootPathById(targetRootPathId);
    if (!ROOT_PATH) {
      return res.status(400).json({ error: `ROOT_PATH ID '${targetRootPathId}' が見つかりません。` });
    }
    
    console.log(`[DownloadService] ROOT_PATH: ${ROOT_PATH}, rootPathId: ${targetRootPathId}, relPath: ${relPath}`);
    
    const absPath = path.join(ROOT_PATH, relPath);
    // パストラバーサル攻撃の基本的な対策
    const resolvedAbsPath = path.resolve(absPath);
    const resolvedRootPath = path.resolve(ROOT_PATH);
    if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
      console.error(`[SECURITY] 不正なパスへのアクセス: relPath='${relPath}'`);
      return res.status(403).json({ error: "不正なパスへのアクセス。" });
    }
    // ファイルの存在チェック
    if (!fsSync.existsSync(resolvedAbsPath)) return res.status(404).json({ error: "ファイルが存在しません" });
    // Content-Dispositionヘッダーを明示的に付与し、ファイル名を安全にエンコード
    const fileName = encodeURIComponent(path.basename(relPath));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
    res.setHeader("Content-Type", "application/octet-stream");
    // ファイルストリームをpipe
    const stream = fsSync.createReadStream(resolvedAbsPath);
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
    const rootPathId = req.query.rootPathId || req.session?.selectedRootPathId;
    
    if (!relPath) return res.status(400).json({ error: "path必須" });
    
    // ROOT_PATH IDが指定されていない場合はデフォルトを使用
    let targetRootPathId = rootPathId;
    if (!targetRootPathId) {
      const defaultRootPath = getDefaultRootPath();
      targetRootPathId = defaultRootPath ? defaultRootPath.id : null;
    }
    
    if (!targetRootPathId) {
      return res.status(400).json({ error: "ROOT_PATHが設定されていません。" });
    }
    
    // ROOT_PATH IDから実際のパスを取得
    const ROOT_PATH = getRootPathById(targetRootPathId);
    if (!ROOT_PATH) {
      return res.status(400).json({ error: `ROOT_PATH ID '${targetRootPathId}' が見つかりません。` });
    }
    
    console.log(`[DownloadService] Folder ZIP: ROOT_PATH=${ROOT_PATH}, rootPathId=${targetRootPathId}, relPath=${relPath}`);
    
    const absPath = path.join(ROOT_PATH, relPath);
    // パストラバーサル攻撃の基本的な対策
    const resolvedAbsPath = path.resolve(absPath);
    const resolvedRootPath = path.resolve(ROOT_PATH);
    if (!resolvedAbsPath.startsWith(resolvedRootPath)) {
      console.error(`[SECURITY] 不正なパスへのアクセス: relPath='${relPath}'`);
      return res.status(403).json({ error: "不正なパスへのアクセス。" });
    }    if (!fsSync.existsSync(resolvedAbsPath)) return res.status(404).json({ error: "フォルダが存在しません" });
    res.setHeader("Content-Type", "application/zip");
    const fileName = encodeURIComponent(path.basename(relPath));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}.zip`);
    console.log(`フォルダのZIPダウンロード: ${resolvedAbsPath} filename="${path.basename(relPath)}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.directory(resolvedAbsPath, false);
    archive.finalize();
    archive.pipe(res);

  } catch (error) {
    console.error("フォルダのZIPダウンロード中にエラー:", error);
    res.status(500).json({ error: "フォルダのZIPダウンロード中にエラーが発生しました。" });
  }
}
