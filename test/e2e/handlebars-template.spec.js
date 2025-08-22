import { test, expect } from '@playwright/test';

test.describe('Handlebarsテンプレート動作確認', () => {
  test('テンプレートファイルがすべて取得可能であること', async ({ page }) => {
    const templateFiles = [
      'auth-status.tmp',
      'breadcrumb.tmp',
      'error.tmp',
      'file-row.tmp',
      'main.tmp',
      'root-path-list.tmp',
      'sidebar.tmp'
    ];

    for (const file of templateFiles) {
      const response = await page.request.get(`http://localhost:3000/assets/${file}`);
      expect(response.status()).toBe(200);
      const content = await response.text();
      expect(content.length).toBeGreaterThan(0);
    }
  });
});
