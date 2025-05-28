import fs from "fs/promises";
import path from "path";
const ROOT_PATH = process.env.ROOT_PATH || "./data";

// TODO データの形式は { path: relPath, files: [{ name: 'file1.txt', type: 'file'/'folder', size: 1234, mtime: '2023-10-01T12:00:00Z' }, ...] }
export async function getList(relPath) {
  const absPath = path.join(ROOT_PATH, relPath);
  const entries = await fs.readdir(absPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(absPath, entry.name);
    let stat;
    try {
      stat = await fs.stat(entryPath);
    } catch (e) {
      continue; // アクセスできないファイルはスキップ
    }
    files.push({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
      size: entry.isFile() ? stat.size : undefined,
      mtime: stat.mtime.toISOString(),
    });
  }
  files.sort((a, b) => {
    // ディレクトリを先、名前順
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { path: relPath, files };
}
