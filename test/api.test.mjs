/**
 * JestでESM(import)構文を使う場合、
 * テストファイルの拡張子を.mjsに変更し、
 * package.jsonの"type": "module"を維持する必要がある。
 * もしくはrequire構文に書き換える。
 */
// Node.js 18の組み込みfetch APIを使用

describe('APIサーバ基本機能', () => {
  const base = 'http://localhost:3000/api';

  test('ファイル一覧取得APIが200を返す', async () => {
    const res = await fetch(`${base}/list`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.files)).toBe(true);
  });

  test('存在しないファイルダウンロードで404', async () => {
    const res = await fetch(`${base}/download/file?path=__notfound__`);
    expect(res.status).toBe(404);
  });

  test('存在しないファイル削除で404', async () => {
    const res = await fetch(`${base}/delete?name=__notfound__`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
