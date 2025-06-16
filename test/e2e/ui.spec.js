// PlaywrightテストはJestから除外するため、このファイルをtest/e2e/など別ディレクトリに移動してください。
// もしくはJestのテストパターンから除外設定を行ってください。

import { test, expect } from '@playwright/test';

test.describe('ファイルエクスプローラUI', () => {
  test('トップ画面が表示される', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForSelector('header');
    await expect(page.locator('header')).toHaveText(/ファイルエクスプローラ/);
    await expect(page.locator('button')).toHaveCount(5); // ログインボタン3種+ログアウト+アップロード
  });

  test('ファイル一覧テーブルが表示される', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    // Hydraログインボタンをクリックして認証
    const hydraLoginBtn = page.locator('.login-btn.hydra');
    await expect(hydraLoginBtn).toBeVisible();
    await hydraLoginBtn.click();
    // 認証完了まで待機
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    // テーブルが表示されることを確認
    await page.waitForSelector('table#file-table');
    await expect(page.locator('table#file-table')).toBeVisible();
    await expect(page.locator('th')).toContainText(['名前', '種類', 'サイズ', '更新日時', '操作']);
  });
});
