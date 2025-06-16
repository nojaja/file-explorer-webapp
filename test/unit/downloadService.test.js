import { jest } from '@jest/globals';
// ダウンロードサービスのユニットテスト
import * as downloadService from '../../src/backend/services/downloadService.js';
import * as authz from '../../src/backend/services/authorizationService.js';
import fs from 'fs/promises';
import path from 'path';
import { Writable } from 'stream';

describe('downloadService', () => {
  let testRootId;
  let testDir;
  let req, res;

  beforeAll(async () => {
    testDir = path.resolve('./test/testdata_dl');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'dl.txt'), 'dl');
    authz.initializeAuthorization();
    const config = { rootPaths: [{ id: 'testroot', path: testDir, isDefault: true, permissions: { 'user@example.com': 'full' } }] };
    Object.assign(authz.authorizationConfig, config);
    testRootId = 'testroot';
  });
  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });
  beforeEach(() => {
    req = { query: { rootPathId: testRootId, path: 'dl.txt' }, user: { email: 'user@example.com' } };
    // resをWritableで拡張し、setHeader, status, json, endをモック
    class MockRes extends Writable {
      constructor() {
        super();
        this.headers = {};
        this.status = jest.fn().mockReturnThis();
        this.json = jest.fn();
        this.setHeader = jest.fn((k, v) => { this.headers[k] = v; });
        this.end = jest.fn();
      }
      _write(chunk, encoding, callback) { callback(); }
    }
    res = new MockRes();
  });
  it('正常系: ファイルダウンロード', async () => {
    await downloadService.downloadFile(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition', expect.stringContaining('dl.txt')
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type', 'application/octet-stream'
    );
    // pipe先としてresが使われるため、例外が出なければOK
  });
  it('異常系: 不正なパス', async () => {
    req.query.path = '../outside.txt';
    await downloadService.downloadFile(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
