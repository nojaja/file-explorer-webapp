import checkDiskSpace from 'check-disk-space';

/**
 * 指定パスのディスク容量情報を取得（check-disk-space使用, クロスプラットフォーム対応）
 * @param {string} path - 対象パス
 * @returns {Promise<{ total: number|null, free: number|null, used: number|null, error?: string }>} 容量情報（バイト単位）
 */
export async function getDiskSpace(path) {
  try {
    const info = await checkDiskSpace(path);
    // info: { diskPath, free, size }
    const total = info.size;
    const free = info.free;
    const used = total - free;
    return { total, free, used };
  } catch (e) {
    return { total: null, free: null, used: null, error: e.message };
  }
}
