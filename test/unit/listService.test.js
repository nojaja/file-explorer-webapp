// リストサービスのユニットテスト
import * as listService from '../../src/backend/services/listService.js';
import * as authz from '../../src/backend/services/authorizationService.js';
import path from 'path';
import fs from 'fs/promises';

describe('listService', () => {
  let testRootId;
  let testDir;

  beforeAll(async () => {
    // テスト用ディレクトリ作成
    testDir = path.resolve('./test/testdata');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'abc');
    await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
    // 認可設定を上書き
    authz.initializeAuthorization();
    // テスト用ROOT_PATHを追加
    const config = { rootPaths: [{ id: 'testroot', path: testDir, isDefault: true, permissions: { 'user@example.com': 'full' } }] };
    Object.assign(authz.authorizationConfig, config);
    testRootId = 'testroot';
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('getListでファイル一覧取得', async () => {
    const result = await listService.getList('', testRootId);
    expect(result.files.some(f => f.name === 'file1.txt')).toBe(true);
    expect(result.files.some(f => f.name === 'subdir')).toBe(true);
  });

  it('不正なパスでエラー', async () => {
    await expect(listService.getList('../', testRootId)).rejects.toThrow();
  });
});
