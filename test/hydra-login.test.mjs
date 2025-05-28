import fetch from 'node-fetch';

describe('Hydra認証フロー', () => {
  const base = 'http://localhost:3000';

  test('ログイン画面が表示される', async () => {
    const res = await fetch(`${base}/login?login_challenge=test_challenge`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('ユーザー名');
    expect(html).toContain('ログイン');
  });

  test('不正なリクエストで400が返る', async () => {
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'login_challenge=&username='
    });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('不正なリクエスト');
  });
});
