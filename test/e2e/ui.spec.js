// PlaywrightテストはJestから除外するため、このファイルをtest/e2e/など別ディレクトリに移動してください。
// もしくはJestのテストパターンから除外設定を行ってください。

import { test, expect } from '@playwright/test';
import { waitForSidebarOrLogin } from './helpers/waitForSidebar.js';
import { getBaseUrl } from './helpers/getBaseUrl.js';
import { hydraLogin } from './helpers/hydraLogin.js';

test.describe('ファイルエクスプローラUI', () => {
  const baseUrl = getBaseUrl();
  test('トップ画面が表示される', async ({ page }) => {
    await page.goto(baseUrl);
    // サイドバーやログインボタンの初期描画を待機
    await waitForSidebarOrLogin(page, { timeout: 15000 });
    await page.waitForSelector('header');
    await expect(page.locator('header')).toHaveText(/ファイルエクスプローラ/);
    // ボタン数は環境や認証状態によって変わるため、最低1個存在することを確認する
    const btnCount = await page.locator('button').count();
    expect(btnCount).toBeGreaterThanOrEqual(1);
  });

  test('ファイル一覧テーブルが表示される', async ({ page }) => {
    await page.goto(baseUrl);
    // サイドバーやログインボタンの初期描画を待機
    await waitForSidebarOrLogin(page, { timeout: 15000 });
    await page.waitForSelector('header');


    // Hydraログインフローを共通ヘルパーで実行
    await hydraLogin(page, baseUrl);

    // テーブルが表示されることを確認
    await page.waitForSelector('table#file-table');
    await expect(page.locator('table#file-table')).toBeVisible();
    await expect(page.locator('th')).toContainText(['名前', '種類', 'サイズ', '更新日時', '操作']);
  });
});
