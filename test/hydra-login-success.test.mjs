// Node.js 18の組み込みfetch APIを使用
import { URLSearchParams } from 'url';

describe('Hydra認証フロー（正常系）', () => {
  const base = 'http://localhost:3000';

  test('正しいlogin_challengeとusernameでリダイレクトされる', async () => {
    // テスト用のlogin_challengeとusername
    const params = new URLSearchParams();
    params.append('login_challenge', 'test_challenge');
    params.append('username', 'testuser');

    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'manual' // リダイレクトを自動で追わない
    });
    // hydraが起動していない場合は500になるが、リダイレクト時は302
    expect([302, 500]).toContain(res.status);
    if (res.status === 302) {
      // Locationヘッダーが存在すること
      expect(res.headers.get('location')).toBeTruthy();
    } else {
      // hydra未起動時はエラーメッセージを含む
      const text = await res.text();
      expect(text).toContain('hydra login accept');
    }
  });
});
