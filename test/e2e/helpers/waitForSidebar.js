// 共通の待機ヘルパ: サイドバーかログインボタンのいずれかが描画されるまで待つ
export async function waitForSidebarOrLogin(page, options = {}) {
  const timeout = options.timeout || 15000;
  // 優先的にサイドバーの認証領域を待つ
  try {
    await page.waitForSelector('#sidebar-auth', { timeout });
    return;
  } catch (err) {
    // サイドバーが来なければ、個別のログインボタンを待つ
  }
  const candidates = ['#hydra-login-btn', '#login-gitlab-btn', '#login-github-btn', '#login-gitlab-btn'];
  for (const sel of candidates) {
    try {
      await page.waitForSelector(sel, { timeout: 2000 });
      return;
    } catch (_) {
      // 次の候補へ
    }
  }
  // 最後の手段: サイドバー本体
  await page.waitForSelector('#sidebar', { timeout });
}
