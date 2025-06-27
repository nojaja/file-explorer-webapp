import { test, expect } from '@playwright/test';

test.describe('Handlebarsテンプレート動作確認', () => {
  test('ページが正常に読み込まれ、テンプレートが動作すること', async ({ page }) => {
    // コンソールエラーを監視
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000');
    
    // サイドバーが存在することを確認
    await expect(page.locator('#sidebar')).toBeVisible();
    
    // 認証状態が表示されることを確認（テンプレート使用）
    await expect(page.locator('#sidebar-auth')).toBeVisible();
    
    // テンプレートファイルが正しく取得されているかネットワークをチェック
    const response = await page.request.get('http://localhost:3000/assets/auth-status.tmp');
    expect(response.status()).toBe(200);
    
    const templateContent = await response.text();
    expect(templateContent).toContain('{{#if authenticated}}');
    
    // JavaScriptエラーがないことを確認
    await page.waitForTimeout(2000); // テンプレート処理完了を待つ
    expect(errors).toHaveLength(0);
  });

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
