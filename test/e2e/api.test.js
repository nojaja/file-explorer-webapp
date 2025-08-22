import { test, expect } from '@playwright/test';
import { getBaseUrl } from './helpers/getBaseUrl.js';
import { hydraLogin } from './helpers/hydraLogin.js';
import { uploadFileInPage } from './helpers/fileupload.js';
import { putTestData, readTestData, removeTestData, ROOT_PATH } from './helpers/testDataCRUD.js';

test.describe('APIサーバ基本機能', () => {
    const baseUrl = getBaseUrl();

    test('ファイル一覧取得APIが200を返す', async ({ page }) => {
        // Hydraログインフローを共通ヘルパーで実行
        await hydraLogin(page, baseUrl);
        // 認証後に/api/listへアクセス
        const res = await page.request.get(`api/list`);
        const status = res.status();
        let bodyText = '';
        try {
            bodyText = await res.text();
        } catch (e) {
            bodyText = '[body取得失敗]';
        }
        console.log('🔎 /api/list status:', status);
        console.log('🔎 /api/list body:', bodyText);
        expect(status).toBe(200);
        // JSONパースできるかも確認
        const data = JSON.parse(bodyText);
        expect(Array.isArray(data.files)).toBe(true);
        console.log('✅ 認証後の/api/listレスポンス確認完了');
    });
    test('存在しないフォルダのファイル一覧取得APIが400を返す', async ({ page }) => {
        // Hydraログインフローを共通ヘルパーで実行
        await hydraLogin(page, baseUrl);
        // 認証後に/api/listへアクセス
        const res = await page.request.get(`api/list?rootPathId=main&path=__notfound__`);
        const status = res.status();
        let bodyText = '';
        try {
            bodyText = await res.text();
        } catch (e) {
            bodyText = '[body取得失敗]';
        }
        console.log('🔎 /api/list status:', status);
        console.log('🔎 /api/list body:', bodyText);
        expect(status).toBe(400);
        // JSONパースできるかも確認
        const data = JSON.parse(bodyText);
        expect(data.error).toMatch(/ディレクトリ '__notfound__' が見つからないか、アクセスできない。/);
        console.log('✅ 認証後の/api/listレスポンス確認完了');
    });

    test('ファイルのアップロードAPIを直接叩いて登録できたかを検証する', async ({ context: _context, page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
        const path = '';
        const uploadFileName = 'playwright-upload-test.txt';
        const uploadFileContent = 'Playwright upload test content';

        // APIエンドポイント
        const apiUrl = new URL(`api/upload`, baseUrl).toString();

        // ファイルアップロードを実行（ヘルパーに切り出し）
        const apiResult = await uploadFileInPage(page, apiUrl, rootPathId, path, uploadFileName, uploadFileContent);
        console.log(apiResult.text,apiResult)
        if (apiResult.error) throw new Error('API fetch failed: ' + apiResult.error);
        expect(apiResult.status).toBe(200);
        //{"success":true,"uploaded":["playwright-upload-test.txt"]}
        expect(apiResult.text).toMatch(/{"success":true,"uploaded":\["playwright-upload-test.txt"\]}/);

        // アップロード後、ファイル一覧APIで存在確認
        const listRes = await page.request.get(`api/list?rootPathId=${rootPathId}`);
        expect(listRes.status()).toBe(200);
        const listBody = await listRes.text();
        const listJson = JSON.parse(listBody);
        expect(listJson.files.some(f => f.name === uploadFileName)).toBe(true);

        // readTestDataでアップロードしたファイルの中身を検証する
        const content = await readTestData(uploadFileName);
        expect(content).toBe(uploadFileContent);

        // 一時ファイル削除
        await removeTestData(uploadFileName);
    });

    test('存在するファイルのダウンロードAPIを直接叩いて内容を検証する', async ({ context: _context, page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
        const path = '';
        const downloadFileName = 'playwright-download-test.txt';
        const downloadFileContent = 'Playwright download test content';
        await putTestData(downloadFileName, downloadFileContent);

        // ページのセッション（クッキー）を使って fetch を実行する
        // 正規化された URL を生成（WEB_ROOT_PATH を含む baseUrl に対して相対パスを使うことで /test/api/... になる）
        const apiUrl = new URL(`api/download/file?rootPathId=${rootPathId}&path=${encodeURIComponent('/' + downloadFileName)}`, baseUrl).toString();

        // page.evaluate 内で fetch を行い、ブラウザの認証クッキーを利用する
        const apiResult = await page.evaluate(async (url) => {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'same-origin' });
                const status = resp.status;
                const contentDisposition = resp.headers.get('content-disposition') || '';
                const contentType = resp.headers.get('content-type') || '';
                const text = await resp.text();
                return { status, contentDisposition, contentType, text };
            } catch (err) {
                return { error: String(err) };
            }
        }, apiUrl);

        if (apiResult.error) throw new Error('API fetch failed: ' + apiResult.error);
        expect(apiResult.status).toBe(200);
        // Content-Disposition は環境差があるため必須チェックは行わない
        expect(apiResult.text.length).toBeGreaterThan(0);
        expect(apiResult.text).toBe(downloadFileContent);

        
        // 一時ファイル削除
        await removeTestData(downloadFileName);
        void _context;
    });

    test('存在しないファイルをダウンロードAPIを直接叩いて404返却を確認', async ({ context: _context, page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);
        // ページのセッション（クッキー）を使って fetch を実行する
        const rootPathId = 'main';
        const pathParam = encodeURIComponent('/__notfound__');
        // 正規化された URL を生成（WEB_ROOT_PATH を含む baseUrl に対して相対パスを使うことで /test/api/... になる）
        const apiUrl = new URL(`api/download/file?rootPathId=${rootPathId}&path=${pathParam}`, baseUrl).toString();

        // page.evaluate 内で fetch を行い、ブラウザの認証クッキーを利用する
        const apiResult = await page.evaluate(async (url) => {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'same-origin' });
                const status = resp.status;
                const contentDisposition = resp.headers.get('content-disposition') || '';
                const contentType = resp.headers.get('content-type') || '';
                const text = await resp.text();
                return { status, contentDisposition, contentType, text };
            } catch (err) {
                return { error: String(err) };
            }
        }, apiUrl);

        if (apiResult.error) throw new Error('API fetch failed: ' + apiResult.error);
        expect(apiResult.status).toBe(404);
    });

    test('存在するファイル削除で200', async ({ context: _context, page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
        const path = '';
        const deleteFileName = 'playwright-delete-test.txt';
        const deleteFileContent = 'Playwright delete test content';
        await putTestData(deleteFileName, deleteFileContent);

        // ファイル削除APIで削除
        const deleteUrl = new URL(`api/delete/file?rootPathId=${rootPathId}&path=${encodeURIComponent('/' + deleteFileName)}`, baseUrl).toString();
        const deleteResult = await page.evaluate(async (url) => {
            const resp = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
            return { status: resp.status, text: await resp.text() };
        }, deleteUrl);
        expect([200]).toContain(deleteResult.status);
        
        
        // 削除後、ファイル一覧APIで存在しないことを確認
        const listResAfter = await page.request.get(`api/list?rootPathId=${rootPathId}`);
        expect(listResAfter.status()).toBe(200);
        const listBodyAfter = await listResAfter.text();
        const listJsonAfter = JSON.parse(listBodyAfter);
        expect(listJsonAfter.files.some(f => f.name === deleteFileName)).toBe(false);

    });

    test('存在しないファイル削除で404', async ({ context: _context, page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
        const path = '';
        const deleteFileName = '__notfound__';

        // ファイル削除APIで削除
        const deleteUrl = new URL(`api/delete/file?rootPathId=${rootPathId}&path=${encodeURIComponent('/' + deleteFileName)}`, baseUrl).toString();
        const deleteResult = await page.evaluate(async (url) => {
            const resp = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
            return { status: resp.status, text: await resp.text() };
        }, deleteUrl);
        expect([404]).toContain(deleteResult.status);
        
        
        // 削除後、ファイル一覧APIで存在しないことを確認
        const listResAfter = await page.request.get(`api/list?rootPathId=${rootPathId}`);
        expect(listResAfter.status()).toBe(200);
        const listBodyAfter = await listResAfter.text();
        const listJsonAfter = JSON.parse(listBodyAfter);
        expect(listJsonAfter.files.some(f => f.name === deleteFileName)).toBe(false);

    });
});
