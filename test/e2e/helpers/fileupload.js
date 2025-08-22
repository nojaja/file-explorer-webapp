export async function uploadFileInPage(page, url, rootPathId, path, fileName, fileContent = 'Playwright upload test content') {
    // page.evaluate で使うシリアライズ可能な関数を構築して実行
    const payload = { url, rootPathId, path, fileName, fileContent };
    return await page.evaluate(async ({ url, rootPathId, path, fileName, fileContent }) => {
        try {
            const file = new File([fileContent], fileName, { type: 'text/plain' });
            const formData = new FormData();
            // サーバ側は 'files' または 'file' どちらでも受け取る可能性があるため 'files' を使用
            formData.append('files', file, fileName);
            formData.append('rootPathId', rootPathId);
            formData.append('path', `${path}`);
            const resp = await fetch(url, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            const status = resp.status;
            const text = await resp.text();
            return { status, text };
        } catch (err) {
            return { error: String(err) };
        }
    }, payload);
}
