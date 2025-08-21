import request from 'supertest';
import express from 'express';
import renameRouter from '../../src/backend/routes/rename.js';
import fs from 'fs/promises';
import path from 'path';

describe('/api/rename', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/rename', renameRouter);
  const testDir = path.resolve(process.cwd(), 'data/test-rename');
  const testFile = path.join(testDir, 'foo.txt');
  const renamedFile = path.join(testDir, 'bar.txt');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, 'dummy');
  });
  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('正常系: ファイル名変更', async () => {
    const res = await request(app)
      .post('/api/rename')
      .send({ path: `test-rename/foo.txt`, newName: 'bar.txt', rootPathId: 'main' });
    expect(res.status).toBe(200);
    expect(await fs.stat(renamedFile)).toBeTruthy();
  });

  it('異常系: 不正文字', async () => {
    const res = await request(app)
      .post('/api/rename')
      .send({ path: `test-rename/bar.txt`, newName: 'a/b.txt', rootPathId: 'main' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/不正な文字/);
  });

  it('異常系: 空文字', async () => {
    const res = await request(app)
      .post('/api/rename')
      .send({ path: `test-rename/bar.txt`, newName: '', rootPathId: 'main' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/空にできません/);
  });

  it('異常系: パストラバーサル', async () => {
    const res = await request(app)
      .post('/api/rename')
      .send({ path: `../foo.txt`, newName: 'baz.txt', rootPathId: 'main' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/パストラバーサル/);
  });

  it('異常系: 重複', async () => {
    await fs.writeFile(path.join(testDir, 'baz.txt'), 'dummy2');
    await fs.writeFile(path.join(testDir, 'bar.txt'), 'dummy3');
    const res = await request(app)
      .post('/api/rename')
      .send({ path: `test-rename/bar.txt`, newName: 'baz.txt', rootPathId: 'main' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/既に存在/);
  });
});
