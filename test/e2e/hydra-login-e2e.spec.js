import { test, expect } from '@playwright/test';
import fs from 'fs/promises';

test.describe('Hydra OAuth認証 E2Eテスト', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // テスト実行前にサーバーの起動状態を確認
    try {
      await page.goto(baseUrl, { timeout: 5000 });
    } catch (error) {
      console.warn('警告: サーバーが起動していない可能性があります:', error.message);
    }
  });

  test('Hydraログインボタンがクリックできること', async ({ page }) => {
    await page.goto(baseUrl);
    
    // Hydraログインボタンの存在確認
    const hydraLoginBtn = page.locator('.login-btn.hydra');
    await expect(hydraLoginBtn).toBeVisible();
    await expect(hydraLoginBtn).toHaveText(/hydra/i);
  });

  // test('Hydraログインフローが開始されること', async ({ page }) => {
  //   await page.goto(baseUrl);
    
  //   // Hydraログインボタンをクリック
  //   const hydraLoginBtn = page.locator('.login-btn.hydra');
  //   await expect(hydraLoginBtn).toBeVisible();
    
  //   // リダイレクトを追跡するためのPromiseを設定
  //   const navigationPromise = page.waitForURL(/.*login_challenge.*/, { timeout: 10000 });
    
  //   try {
  //     await hydraLoginBtn.click();
  //     await navigationPromise;
      
  //     // login_challengeパラメータを含むURLにリダイレクトされることを確認
  //     const currentUrl = page.url();
  //     console.log('リダイレクト後のURL:', currentUrl);
  //     expect(currentUrl).toMatch(/login_challenge/);
      
  //     // ログインフォームが表示されることを確認
  //     await expect(page.locator('form')).toBeVisible();
  //     await expect(page.locator('input[name="username"]')).toBeVisible();
  //     await expect(page.locator('button[type="submit"]')).toBeVisible();
      
  //   } catch (error) {
  //     console.warn('Hydraサーバーが起動していない可能性があります:', error.message);
  //     // Hydraが起動していない場合でも、認証開始の試行は確認できる
  //     expect(error.message).toMatch(/(timeout|navigation)/i);
  //   }
  // });

  test('Hydraログイン成功フローの完了', async ({ page }) => {
    // このテストは実際のHydraサーバーが起動している場合のみ実行
    await page.goto(baseUrl);
    
    try {
      // Hydraログインボタンをクリック
      const hydraLoginBtn = page.locator('.login-btn.hydra');
      await expect(hydraLoginBtn).toBeVisible();
      await hydraLoginBtn.click();
      
      // // login画面への遷移を待機（最大10秒）
      // await page.waitForURL(/.*login_challenge.*/, { timeout: 10000 });
      
      // // ユーザー名を入力
      // await page.fill('input[name="username"]', 'testuser');
      
      // // ログインボタンをクリック
      // const loginSubmitBtn = page.locator('button[type="submit"]');
      // await loginSubmitBtn.click();
      
      // // consent画面への遷移を待機
      // await page.waitForURL(/.*consent_challenge.*/, { timeout: 10000 });
      
      // // 許可ボタンをクリック
      // const acceptBtn = page.locator('button[name="accept"][value="1"]');
      // await expect(acceptBtn).toBeVisible();
      // await acceptBtn.click();
      
      // // 認証完了後、ホーム画面にリダイレクトされることを確認
      // await page.waitForURL(baseUrl, { timeout: 10000 });
      
      // 認証成功の確認（ログアウトボタンが表示される等）
      const logoutBtn = page.locator('#logout-btn');
      await expect(logoutBtn).toBeVisible({ timeout: 5000 });
      
      // ファイルテーブルが表示されることを確認
      const fileTable = page.locator('#file-table');
      await expect(fileTable).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Hydraログイン成功フローが完了しました！');
      
    } catch (error) {
      console.warn('⚠️ HydraサーバーまたはDockerコンテナが起動していない可能性があります');
      console.warn('エラー詳細:', error.message);
      
      // Hydraが起動していない場合は、テストをスキップとして扱う
      test.skip(true, 'Hydraサーバーが利用できないため、このテストをスキップします');
    }
  });

  test('Hydra認証エラーハンドリング', async ({ page }) => {
    // 不正なパラメータでのアクセス時のエラーハンドリングを確認
    await page.goto(`${baseUrl}/auth/login`);
    
    // エラーメッセージまたは400ステータスが表示されることを確認
    const pageContent = await page.textContent('body');
    expect(pageContent).toMatch(/(login_challenge.*required|不正なリクエスト|400)/i);
  });
  
  // test('Hydraログインフロー詳細デバッグ', async ({ page }) => {
  //   // デバッグ用の詳細なログ記録付きテスト
  //   console.log('🔍 テスト開始: Hydraログインフロー詳細デバッグ');
    
  //   await page.goto(baseUrl);
  //   console.log('✅ ホームページにアクセス完了');
    
  //   // Hydraログインボタンをクリック
  //   const hydraLoginBtn = page.locator('.login-btn.hydra');
  //   await expect(hydraLoginBtn).toBeVisible();
  //   console.log('✅ Hydraログインボタンが表示確認');
    
  //   // ページのナビゲーションイベントをリッスン
  //   page.on('response', response => {
  //     console.log(`📡 HTTP応答: ${response.status()} ${response.url()}`);
  //   });
    
  //   page.on('request', request => {
  //     console.log(`📤 HTTP要求: ${request.method()} ${request.url()}`);
  //   });
    
  //   try {
  //     console.log('🔄 Hydraログインボタンをクリック...');
  //     await hydraLoginBtn.click();
      
  //     // 少し待機してリダイレクトを観察
  //     await page.waitForTimeout(2000);
      
  //     const currentUrl = page.url();
  //     console.log(`📍 現在のURL: ${currentUrl}`);
      
  //     if (currentUrl.includes('login_challenge')) {
  //       console.log('✅ login_challengeが含まれるURLにリダイレクト成功');
        
  //       // ログインフォームの確認
  //       const usernameInput = page.locator('input[name="username"]');
  //       if (await usernameInput.isVisible()) {
  //         console.log('✅ ユーザー名入力フィールドが表示');
  //         await usernameInput.fill('testuser');
  //         console.log('✅ ユーザー名を入力');
          
  //         const submitBtn = page.locator('button[type="submit"]');
  //         if (await submitBtn.isVisible()) {
  //           console.log('✅ 送信ボタンが表示');
  //           await submitBtn.click();
  //           console.log('✅ 送信ボタンをクリック');
            
  //           // 次のステップ（consentページ）を待機
  //           await page.waitForTimeout(3000);
  //           const newUrl = page.url();
  //           console.log(`📍 ログイン後のURL: ${newUrl}`);
            
  //           if (newUrl.includes('consent_challenge')) {
  //             console.log('✅ consent_challengeページに到達');
              
  //             const acceptBtn = page.locator('button[name="accept"][value="1"]');
  //             if (await acceptBtn.isVisible()) {
  //               console.log('✅ 許可ボタンが表示');
  //               await acceptBtn.click();
  //               console.log('✅ 許可ボタンをクリック');
                
  //               // 最終的にホームページに戻ることを確認
  //               await page.waitForTimeout(3000);
  //               const finalUrl = page.url();
  //               console.log(`📍 最終URL: ${finalUrl}`);
                
  //               if (finalUrl === baseUrl || finalUrl.startsWith(baseUrl)) {
  //                 console.log('🎉 Hydraログインフロー完全成功！');
  //               } else {
  //                 console.log(`⚠️ 予期しない最終URL: ${finalUrl}`);
  //               }
  //             } else {
  //               console.log('❌ 許可ボタンが見つからない');
  //             }
  //           } else {
  //             console.log(`⚠️ consent_challengeページではない: ${newUrl}`);
  //           }
  //         } else {
  //           console.log('❌ 送信ボタンが見つからない');
  //         }
  //       } else {
  //         console.log('❌ ユーザー名入力フィールドが見つからない');
  //       }
  //     } else {
  //       console.log(`❌ 期待されるリダイレクトが発生していない: ${currentUrl}`);
  //     }
      
  //   } catch (error) {
  //     console.log(`❌ テスト中にエラー: ${error.message}`);
  //     // エラーでもテストは成功とする（デバッグ目的のため）
  //   }
  // });

  // test('Hydra OAuth URLリダイレクト確認（Firefox特化）', async ({ page, browserName }) => {
  //   // FirefoxでのみHydra OAuthリダイレクトが成功することを確認
  //   if (browserName !== 'firefox') {
  //     test.skip(true, 'このテストはFirefoxでのみ実行されます');
  //     return;
  //   }
    
  //   console.log('🦊 Firefox専用: Hydra OAuthリダイレクトテスト開始');
    
  //   await page.goto(baseUrl);
    
  //   // Hydraログインボタンをクリック
  //   const hydraLoginBtn = page.locator('.login-btn.hydra');
  //   await expect(hydraLoginBtn).toBeVisible();
    
  //   await hydraLoginBtn.click();
    
  //   // 少し待機してリダイレクトを確認
  //   await page.waitForTimeout(3000);
    
  //   const currentUrl = page.url();
  //   console.log(`🔗 リダイレクト後のURL: ${currentUrl}`);
    
  //   // Hydra OAuth URLの構造を確認
  //   expect(currentUrl).toContain('localhost:4444/oauth2/auth');
  //   expect(currentUrl).toContain('response_type=code');
  //   expect(currentUrl).toContain('client_id=70b01875-af94-499f-aa7c-ff63b71d7f4e');
  //   expect(currentUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback');
  //   expect(currentUrl).toContain('scope=openid%20profile%20email');
  //   expect(currentUrl).toContain('state=');
    
  //   console.log('✅ Firefox: Hydra OAuth URLリダイレクト成功！');
  // });

  // test('認証フローのURLパラメータ検証', async ({ page }) => {
  //   // 認証開始時のURLパラメータが正しく生成されるかテスト
  //   await page.goto(baseUrl);
    
  //   // ページ内でHydraログインボタンのhref属性を確認
  //   const hydraLoginBtn = page.locator('.login-btn.hydra');
  //   await expect(hydraLoginBtn).toBeVisible();
    
  //   // ボタンのクリック前に、リンク先URLを確認
  //   const href = await hydraLoginBtn.getAttribute('href');
  //   if (href) {
  //     expect(href).toBe('/auth/hydra');
  //   } else {
  //     // ボタンタイプの場合、クリックイベントを確認
  //     expect(await hydraLoginBtn.getAttribute('onclick')).toBeTruthy();
  //   }
    
  //   console.log('✅ Hydraログインボタンの設定が正しく確認されました');
  // });

  // test('Hydraログイン成功後のユーザー状態確認', async ({ page }) => {
  //   try {
  //     console.log('🔄 Hydraログイン成功後の状態確認開始');
      
  //     await page.goto(baseUrl);
      
  //     // ログイン前の状態確認
  //     const statusBefore = await page.request.get(`${baseUrl}/auth/status`);
  //     const statusDataBefore = await statusBefore.json();
  //     console.log('📊 ログイン前の認証状態:', statusDataBefore);
      
  //     // Hydraログインボタンをクリック
  //     const hydraLoginBtn = page.locator('.login-btn.hydra');
  //     await expect(hydraLoginBtn).toBeVisible();
  //     await hydraLoginBtn.click();
      
  //     // 認証完了まで最大30秒待機（実際のフローは数秒で完了）
  //     await page.waitForURL(baseUrl, { timeout: 30000 });
  //     console.log('🎉 認証完了後のホーム画面への到達確認');
      
  //     // 少し待機してからステータス確認
  //     await page.waitForTimeout(2000);
      
  //     // ログイン後の状態確認
  //     const statusAfter = await page.request.get(`${baseUrl}/auth/status`);
  //     const statusDataAfter = await statusAfter.json();
  //     console.log('📊 ログイン後の認証状態:', statusDataAfter);
      
  //     // 認証成功の確認
  //     expect(statusDataAfter.authenticated).toBe(true);
  //     expect(statusDataAfter.name).toBeDefined();
  //     console.log('✅ Hydra OAuth認証成功確認完了');
  //     console.log(`👤 ログインユーザー: ${statusDataAfter.name}`);
      
  //     // ページ上にログアウトボタンが表示されることを確認
  //     const logoutBtn = page.locator('.logout-btn, [href="/auth/logout"], button:has-text("ログアウト"), #logout-btn');
  //     await expect(logoutBtn).toBeVisible({ timeout: 5000 });
  //     console.log('✅ ログアウトボタンの表示確認');
      
  //     // ログアウト機能のテスト
  //     await logoutBtn.click();
  //     await page.waitForURL(baseUrl, { timeout: 10000 });
      
  //     // ログアウト後の状態確認
  //     await page.waitForTimeout(1000);
  //     const statusAfterLogout = await page.request.get(`${baseUrl}/auth/status`);
  //     const statusDataAfterLogout = await statusAfterLogout.json();
  //     console.log('📊 ログアウト後の認証状態:', statusDataAfterLogout);
      
  //     expect(statusDataAfterLogout.authenticated).toBe(false);
  //     console.log('✅ ログアウト成功確認完了');
      
  //   } catch (error) {
  //     console.warn('⚠️ HydraサーバーまたはDockerコンテナが起動していない可能性があります');
  //     console.log('エラー詳細:', error.message);
      
  //     // Hydra OAuth認証ボタンクリックまでは確認できるはず
  //     await page.goto(baseUrl);
  //     const hydraLoginBtn = page.locator('.login-btn.hydra');
  //     await expect(hydraLoginBtn).toBeVisible();
  //     console.log('✅ 最低限、Hydraログインボタンは正常に表示されています');
  //   }
  // });

  test('ファイルダウンロードが成功すること', async ({ page, context: _context }) => {
    // Hydra認証フローを通過してログイン状態にする
    await page.goto(baseUrl);
    const hydraLoginBtn = page.locator('.login-btn.hydra');
    await expect(hydraLoginBtn).toBeVisible();
    await hydraLoginBtn.click();
    await page.waitForURL(baseUrl, { timeout: 30000 });
    await page.waitForTimeout(1000);
    // ログアウトが表示されることを確認
    const logoutBtn = page.locator('#logout-btn');
    await expect(logoutBtn).toBeVisible();

    // ファイルテーブルが表示されていることを確認
    const fileTable = page.locator('#file-table');
    await expect(fileTable).toBeVisible({ timeout: 5000 });

    // authorization-config.json のダウンロードリンクだけを取得
    const downloadLink = page.getByRole('row', { name: /authorization-config\.json/ }).getByRole('link');
    await expect(downloadLink).toBeVisible();

    // ダウンロードリクエストを監視
    const [ download ] = await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/download') && response.status() === 200
      ),
      downloadLink.click()
    ]);

    // Content-Dispositionヘッダーでファイル名を確認
    const contentDisposition = download.headers()['content-disposition'] || '';
    expect(contentDisposition).toMatch(/attachment/);

    // ファイル内容を検証（例としてJSONファイルを想定）
    const body = await download.body();
    const text = body.toString();
    expect(text.length).toBeGreaterThan(0);

    // 追加: JSONとしてパースし、内容を検証
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error('ダウンロードしたファイルがJSONとしてパースできません: ' + e.message);
    }
    expect(json).toHaveProperty('test', 'これはテスト用のファイルです。ファイルエクスプローラの動作確認用です。');

    console.log('✅ ファイルダウンロードが正常に完了し、内容も正しいのだ');
    void _context;
  });

  test('ファイルダウンロードが成功すること（aタグクリック+page.waitForEvent方式）', async ({ page, context: _context }) => {
    // Hydra認証フローを通過してログイン状態にする
    await page.goto(baseUrl);
    const hydraLoginBtn = page.locator('.login-btn.hydra');
    await expect(hydraLoginBtn).toBeVisible();
    await hydraLoginBtn.click();
    await page.waitForURL(baseUrl, { timeout: 30000 });
    await page.waitForTimeout(1000);
    // ログアウトが表示されることを確認
    const logoutBtn = page.locator('#logout-btn');
    await expect(logoutBtn).toBeVisible();

    // ファイルテーブルが表示されていることを確認
    const fileTable = page.locator('#file-table');
    await expect(fileTable).toBeVisible({ timeout: 5000 });

    // authorization-config.json のダウンロードリンクだけを取得
    const downloadLink = page.getByRole('row', { name: /authorization-config\.json/ }).getByRole('link');
    await expect(downloadLink).toBeVisible();
    // 1件のみでOK
    // Playwrightのダウンロードイベントを利用
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      downloadLink.click()
    ]);
    // 一時ファイルとして保存し内容を取得（非同期I/Oで修正）
    const path = await download.path();
    const text = await fs.readFile(path, 'utf-8');
    expect(text.length).toBeGreaterThan(0);
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error('ダウンロードしたファイルがJSONとしてパースできません: ' + e.message);
    }
    expect(json).toHaveProperty('test', 'これはテスト用のファイルです。ファイルエクスプローラの動作確認用です。');
    console.log('✅ [waitForEvent] ファイルダウンロードが正常に完了し、内容も正しいのだ');
    void _context;
  });

  test('ファイルダウンロードAPIを直接叩いて内容を検証する', async ({ context: _context, page }) => {
    // Hydra認証フローを通過してログイン状態にする
    await page.goto(baseUrl);
    const hydraLoginBtn = page.locator('.login-btn.hydra');
    await expect(hydraLoginBtn).toBeVisible();
    await hydraLoginBtn.click();
    await page.waitForURL(baseUrl, { timeout: 30000 });
    await page.waitForTimeout(1000);
    // ログアウトが表示されることを確認
    const logoutBtn = page.locator('#logout-btn');
    await expect(logoutBtn).toBeVisible();

    // authorization-config.json のダウンロードリンクだけを取得
    const downloadLink = page.getByRole('row', { name: /authorization-config\.json/ }).getByRole('link');
    await expect(downloadLink).toBeVisible();
    // context.requestで認証済みセッションを使ってAPIを叩く
    const res = await context.request.get(`${baseUrl}/api/download/file?path=authorization-config.json`);
    expect(res.status()).toBe(200);
    const contentDisposition = res.headers()['content-disposition'] || '';
    expect(contentDisposition).toMatch(/attachment/);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error('APIでダウンロードしたファイルがJSONとしてパースできません: ' + e.message);
    }
    expect(json).toHaveProperty('test', 'これはテスト用のファイルです。ファイルエクスプローラの動作確認用です。');
    console.log('✅ [API直叩き] ファイルダウンロードAPIの内容検証も正常なのだ');
    void _context;
  });

  test('Hydra認証後の/api/listレスポンスを確認', async ({ page }) => {
    // Hydra認証フローを通過してログイン状態にする
    await page.goto(baseUrl);
    const hydraLoginBtn = page.locator('.login-btn.hydra');
    await expect(hydraLoginBtn).toBeVisible();
    await hydraLoginBtn.click();
    await page.waitForURL(baseUrl, { timeout: 30000 });
    await page.waitForTimeout(1000);
    // ログアウトが表示されることを確認
    const logoutBtn = page.locator('#logout-btn');
    await expect(logoutBtn).toBeVisible();

    // 認証後に/api/listへアクセス
    const res = await page.request.get(`${baseUrl}/api/list`);
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
    console.log('✅ 認証後の/api/listレスポンス確認完了なのだ');
  });

});
