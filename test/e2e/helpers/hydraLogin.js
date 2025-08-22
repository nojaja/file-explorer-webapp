import { expect } from '@playwright/test';

/**
 * Hydra認証フローを通過してログイン状態にするユーティリティ
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function hydraLogin(page, baseUrl /* options not used */) {
    await page.goto(baseUrl);

    // 可能ならログインボタンをクリックする（無ければフォールバック）
    try {
        const hydraLoginBtn = page.locator('#hydra-login-btn');
        await expect(hydraLoginBtn).toBeVisible();
        console.log('✅ Hydraログインボタン確認');

        if (await hydraLoginBtn.count() > 0) {
            await hydraLoginBtn.click();
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('hydraLogin: #hydra-login-btn をクリックできませんでした。polling にフォールバックします。', err);
    }

    // 認証完了を待つ（認証が完了するとログアウトボタンが表示される）
    const logoutBtn = page.locator('#logout-btn');
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ 認証完了後のホーム画面に到達');

}

export default hydraLogin;
