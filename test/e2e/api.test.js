import { test, expect } from '@playwright/test';
import { getBaseUrl } from './helpers/getBaseUrl.js';
import { hydraLogin } from './helpers/hydraLogin.js';
import { uploadFileInPage } from './helpers/fileupload.js';
import { putTestData, readTestData, removeTestData } from './helpers/testDataCRUD.js';

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
        await expect(status).toBe(200);
        // JSONパースできるかも確認
        const data = JSON.parse(bodyText);
        await expect(Array.isArray(data.files)).toBe(true);
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
        await expect(status).toBe(400);
        // JSONパースできるかも確認
        const data = JSON.parse(bodyText);
        await expect(data.error).toMatch(/ディレクトリ '__notfound__' が見つからないか、アクセスできない。/);
        console.log('✅ 認証後の/api/listレスポンス確認完了');
    });

    test('ファイルのアップロードAPIを直接叩いて登録できたかを検証する', async ({ page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
        const uploadFileName = 'playwright-upload-test.txt';
        const uploadFileContent = 'Playwright upload test content';

        // APIエンドポイント
        const apiUrl = new URL(`api/upload`, baseUrl).toString();

        // ファイルアップロードを実行（ヘルパーに切り出し）
        const apiResult = await uploadFileInPage(page, {
            url: apiUrl,
            rootPathId,
            path: '',
            fileName: uploadFileName,
            fileContent: uploadFileContent,
        });
        console.log(apiResult.text,apiResult)
        if (apiResult.error) throw new Error('API fetch failed: ' + apiResult.error);
        await expect(apiResult.status).toBe(200);
        //{"success":true,"uploaded":["playwright-upload-test.txt"]}
        await expect(apiResult.text).toMatch(/{"success":true,"uploaded":\["playwright-upload-test.txt"\]}/);

        // アップロード後、ファイル一覧APIで存在確認
        const listRes = await page.request.get(`api/list?rootPathId=${rootPathId}`);
        await expect(listRes.status()).toBe(200);
        const listBody = await listRes.text();
        const listJson = JSON.parse(listBody);
        await expect(listJson.files.some(f => f.name === uploadFileName)).toBe(true);

        // readTestDataでアップロードしたファイルの中身を検証する
        const content = await readTestData(uploadFileName);
        await expect(content).toBe(uploadFileContent);

        // 一時ファイル削除
        await removeTestData(uploadFileName);
    });

    test('存在するファイルのダウンロードAPIを直接叩いて内容を検証する', async ({ page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
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
        await expect(apiResult.status).toBe(200);
        // Content-Disposition は環境差があるため必須チェックは行わない
        await expect(apiResult.text.length).toBeGreaterThan(0);
        await expect(apiResult.text).toBe(downloadFileContent);

        // 一時ファイル削除
        await removeTestData(downloadFileName);
    });

    test('存在しないファイルをダウンロードAPIを直接叩いて404返却を確認', async ({ page }) => {
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

    test('存在するファイル削除で200', async ({ page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
        const deleteFileName = 'playwright-delete-test.txt';
        const deleteFileContent = 'Playwright delete test content';
        await putTestData(deleteFileName, deleteFileContent);

        // ファイル削除APIで削除
        const deleteUrl = new URL(`api/delete/file?rootPathId=${rootPathId}&path=${encodeURIComponent('/' + deleteFileName)}`, baseUrl).toString();
        const deleteResult = await page.evaluate(async (url) => {
            const resp = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
            return { status: resp.status, text: await resp.text() };
        }, deleteUrl);
        await expect([200]).toContain(deleteResult.status);
        
        // 削除後、ファイル一覧APIで存在しないことを確認
        const listResAfter = await page.request.get(`api/list?rootPathId=${rootPathId}`);
        await expect(listResAfter.status()).toBe(200);
        const listBodyAfter = await listResAfter.text();
        const listJsonAfter = JSON.parse(listBodyAfter);
        await expect(listJsonAfter.files.some(f => f.name === deleteFileName)).toBe(false);

    });

    test('10000ファイルが入ったフォルダ(/DeleteTest)を削除して200を返す', async ({ page }) => {
        // このテストは長時間処理を待つためテストタイムアウトを延長する
        test.setTimeout(600000); // 10分
        const rootPathId = 'main';
        const folderName = '/DeleteTest';

        // 事前準備: 10000ファイルを配置する
        // putTestData は個別ファイルを配置するヘルパーを想定しているのでループで配置する
        const fileCount = 10000;
        for (let i = 0; i < fileCount; i++) {
            // 名前衝突を避けるために連番ファイル名を使用
            const name = `delete_test_${i}.txt`;
            // contentは適当な1000文字
            const content = `content-${i}`.padEnd(1000, ' ');
            // putTestData はルート直下にファイルを作る既存のユーティリティを利用
            // フォルダ内作成がサポートされている場合はパスを調整してください
            // ここでは putTestData が assets 配下やテスト用ルートに書き込む想定とする
            // await putTestData(`${folderName}/${name}`, content);
            // 既存のputTestDataがルートのみを想定する場合は、ファイル名にフォルダを含めたパスで渡すか、別ヘルパーを作成する必要があります。
            await putTestData(`${folderName}/${name}`, content);
            if ((i + 1) % 1000 === 0) console.log(`作成済み: ${i + 1}/${fileCount}`);
        }

        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // フォルダ削除APIを呼び出す
        const deleteUrl = new URL(`api/delete/file?rootPathId=${rootPathId}&path=${encodeURIComponent(folderName)}`, baseUrl).toString();

        const resp = await page.request.delete(deleteUrl);
        const deleteResult = { status: resp.status(), text: await resp.text() };


        // const deleteResult = await page.evaluate(async (url) => {
        //     try {
        //         const resp = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
        //         return { status: resp.status, text: await resp.text() };
        //     } catch (err) {
        //         console.error('Error occurred while deleting folder:', err);
        //         return { status: 500, text: 'Internal Server Error' };
        //     }
        // }, deleteUrl);

        // 削除成功を期待（環境によっては処理に時間がかかるため200以外の一時的コードを許容したい場合は適宜調整）
        await expect([200]).toContain(deleteResult.status);

        // 削除後、一覧APIでフォルダが存在しないことを確認
        const listResAfter = await page.request.get(`api/list?rootPathId=${rootPathId}`);
        await expect(listResAfter.status()).toBe(200);
        const listBodyAfter = await listResAfter.text();
        const listJsonAfter = JSON.parse(listBodyAfter);
        // フォルダ名がそのままリストに出る実装か、またはファイル名でチェックする実装かで検証を変えてください
        // ここではファイルの一覧に folder 内のファイルが存在しないことを確認
        const anyRemaining = listJsonAfter.files.some(f => (f.path || f.name || '').startsWith(folderName.replace(/^\/+/, '')));
        await expect(anyRemaining).toBe(false);

    });

    test('存在しないファイル削除で404', async ({ page }) => {
        // Hydra認証フローを通過してログイン状態にする
        await hydraLogin(page, baseUrl);

        // テスト用ファイル名・内容
        const rootPathId = 'main';
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
