// メール取得機能の検証テスト
import { test, expect } from '@playwright/test';

test.describe('Hydraメール取得機能検証', () => {
  const baseUrl = 'http://localhost:3000';

  test('Hydraログイン後にメール情報が取得できること', async ({ page }) => {
    console.log('🔄 Hydraメール取得テスト開始');
    
    try {
      // ホームページにアクセス
      await page.goto(baseUrl);
      
      // Hydraログインボタンをクリック
  const hydraLoginBtn = page.locator('#hydra-login-btn');
      await expect(hydraLoginBtn).toBeVisible();
      console.log('✅ Hydraログインボタン確認');
      
      await hydraLoginBtn.click();
      
      // 認証完了まで待機
      await page.waitForURL(baseUrl, { timeout: 30000 });
      console.log('✅ 認証完了後のホーム画面に到達');
      
      // 少し待機してセッションを安定化
      await page.waitForTimeout(2000);
      
      // 認証ステータスAPIを呼び出し
      const statusResponse = await page.request.get(`${baseUrl}/auth/status`);
      expect(statusResponse.ok()).toBeTruthy();
      
      const statusData = await statusResponse.json();
      console.log('📊 認証ステータス:', JSON.stringify(statusData, null, 2));
      
      // 認証状態とメール情報を確認
      expect(statusData.authenticated).toBe(true);
      expect(statusData.provider).toBe('hydra');
      expect(statusData.email).toBeDefined();
      expect(statusData.email).not.toBe('');
      
      // メールが期待値（testuser@example.com）であることを確認
      expect(statusData.email).toBe('testuser@example.com');
      
      console.log('✅ メール取得成功:', statusData.email);
      console.log('✅ ユーザー名:', statusData.name);
      
      // ログアウトボタンが表示されることも確認
      const logoutBtn = page.locator('#logout-btn');
      await expect(logoutBtn).toBeVisible();
      
    } catch (error) {
      console.error('❌ テストエラー:', error.message);
      throw error;
    }
  });
  
  test('複数回のログインでもメール情報が一貫していること', async ({ page }) => {
    console.log('🔄 複数回ログインでのメール一貫性テスト開始');
    
    const emails = [];
    
    for (let i = 0; i < 2; i++) {
      console.log(`--- ログインサイクル ${i + 1} ---`);
      
      // ホームページにアクセス
      await page.goto(baseUrl);
      
      // 既にログインしている場合はログアウト
      const logoutBtn = page.locator('#logout-btn');
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
      }
      
      // Hydraログイン
      const hydraLoginBtn = page.locator('.login-btn.hydra');
      await expect(hydraLoginBtn).toBeVisible();
      await hydraLoginBtn.click();
      
      // 認証完了まで待機
      await page.waitForURL(baseUrl, { timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // メール情報を取得
      const statusResponse = await page.request.get(`${baseUrl}/auth/status`);
      const statusData = await statusResponse.json();
      
      console.log(`📧 ログイン${i + 1}回目のメール:`, statusData.email);
      emails.push(statusData.email);
      
      expect(statusData.authenticated).toBe(true);
      expect(statusData.email).toBeDefined();
    }
    
    // 全てのメールが同じであることを確認
    expect(emails[0]).toBe(emails[1]);
    expect(emails[0]).toBe('testuser@example.com');
    
    console.log('✅ メール情報の一貫性確認完了');
  });
});
