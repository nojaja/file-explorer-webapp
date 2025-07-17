import { jest } from '@jest/globals';
// 削除サービスのユニットテスト
import * as deleteService from '../../src/backend/services/deleteService.js';
import * as authz from '../../src/backend/services/authorizationService.js';
import fs from 'fs/promises';
import path from 'path';

describe('deleteService', () => {
  let testRootId;
  let testDir;
  let req, res;

  beforeAll(async () => {
    testDir = path.resolve('./test/testdata_del');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'del.txt'), 'del');
    // 認可設定パスをテスト用にセット
    global.config = global.config || {};
    global.config.authorizationConfigPath = path.resolve('./test/test-authorization-config.json');
    // ダミー認可設定ファイル作成
    const dummyConfig = {
      rootPaths: [{ id: 'testroot', path: testDir, isDefault: true, permissions: { 'user@example.com': 'full' } }],
      authorization: { rules: [], defaultPermission: 'full', permissions: { full: { canView: true, canDownload: true, canUpload: true, canDelete: true } } }
    };
    await fs.writeFile(global.config.authorizationConfigPath, JSON.stringify(dummyConfig), 'utf8');
    authz.initializeAuthorization();
    testRootId = 'testroot';
  });
  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });
  beforeEach(() => {
    req = { query: { rootPathId: testRootId, path: 'del.txt' }, user: { email: 'user@example.com' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });
  it('正常系: ファイル削除', async () => {
    await deleteService.deleteFile(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    // ファイルが消えている
    await expect(fs.stat(path.join(testDir, 'del.txt'))).rejects.toThrow();
  });
  it('異常系: 不正なパス', async () => {
    req.query.path = '../outside.txt';
    await deleteService.deleteFile(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
