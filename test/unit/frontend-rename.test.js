import { jest } from '@jest/globals';
import { FileManager } from '../../src/frontend/js/file.js';

describe('リネームUI', () => {
  let fileManager;
  beforeEach(() => {
    document.body.innerHTML = `<table><tbody id='file-list'></tbody></table>`;
    fileManager = new FileManager();
    window.fileManager = fileManager;
    // テンプレート取得時はダミーHTMLを返すfetchモック
    global.fetch = jest.fn((url) => {
      if (url.includes('/assets/file-row.tmp')) {
        return Promise.resolve({
          ok: true,
          text: async () => `<tr><td>{{name}}</td><td><button title='リネーム' onclick='startRenameFile("{{path}}", "{{name}}")'>リネーム</button></td></tr>`
        });
      }
      if (url.includes('/assets/error.tmp')) {
        return Promise.resolve({
          ok: true,
          text: async () => `<div>{{message}}</div>`
        });
      }
      // その他APIは空配列返却
      return Promise.resolve({
        ok: true,
        json: async () => ({ files: [] })
      });
    });
  });

  it('リネームボタン押下で編集inputが表示される', async () => {
    await fileManager.renderFiles([
      { name: 'foo.txt', path: 'foo.txt', type: 'file', size: 1, mtime: 'now' }
    ]);
    document.querySelector("button[title='リネーム']").click();
    expect(document.querySelector('.rename-input')).toBeTruthy();
  });

  it('空文字でバリデーションエラー', async () => {
    await fileManager.renderFiles([
      { name: 'foo.txt', path: 'foo.txt', type: 'file', size: 1, mtime: 'now' }
    ]);
    document.querySelector("button[title='リネーム']").click();
    const input = document.querySelector('.rename-input');
    input.value = '';
    window.confirmRenameFile('foo.txt');
    expect(window._renameTarget).toBeTruthy(); // エラーで編集モード継続
  });

  it('不正文字でバリデーションエラー', async () => {
    await fileManager.renderFiles([
      { name: 'foo.txt', path: 'foo.txt', type: 'file', size: 1, mtime: 'now' }
    ]);
    document.querySelector("button[title='リネーム']").click();
    const input = document.querySelector('.rename-input');
    input.value = 'a/b.txt';
    window.confirmRenameFile('foo.txt');
    expect(window._renameTarget).toBeTruthy();
  });

  it('キャンセルで元に戻る', async () => {
    await fileManager.renderFiles([
      { name: 'foo.txt', path: 'foo.txt', type: 'file', size: 1, mtime: 'now' }
    ]);
    document.querySelector("button[title='リネーム']").click();
    window.cancelRenameFile();
    expect(document.querySelector('.rename-input')).toBeFalsy();
  });
});
