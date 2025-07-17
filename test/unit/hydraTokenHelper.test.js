// Jestユニットテスト: hydraTokenHelper.js
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/backend/authProviderConfig.js', () => ({
  getAuthProviderConfig: (fqdn, provider) => {
    if ((provider || '').toLowerCase() === 'hydra') {
      return {
        HYDRA_USERINFO_URL_INTERNAL: 'http://hydra:4444/userinfo',
        HYDRA_ADMIN_URL_INTERNAL: 'http://hydra:4445',
        HYDRA_TOKEN_URL_INTERNAL: 'http://hydra:4444/oauth/token'
      };
    }
    return {};
  }
}));

let getHydraUserInfo, acceptLoginChallenge, acceptConsentChallenge, getConsentRequest;
beforeAll(async () => {
  const mod = await import('../../src/backend/util/hydraTokenHelper.js');
  getHydraUserInfo = mod.getHydraUserInfo;
  acceptLoginChallenge = mod.acceptLoginChallenge;
  acceptConsentChallenge = mod.acceptConsentChallenge;
  getConsentRequest = mod.getConsentRequest;
});

// fetchをグローバルmock
beforeEach(() => {
  global.fetch = jest.fn();
  global.authConfig = {
    hydra: {
      HYDRA_USERINFO_URL_INTERNAL: 'http://hydra:4444/userinfo',
      HYDRA_ADMIN_URL_INTERNAL: 'http://hydra:4445'
    }
  };
});
afterEach(() => {
  jest.resetAllMocks();
});

describe('hydraTokenHelperメソッド網羅テスト', () => {
  describe('getHydraUserInfo', () => {
    const dummyReq = { headers: { host: 'localhost' } };
    it('正常系: ユーザー情報取得成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'user1', email: 'test@example.com' })
      });
      const result = await getHydraUserInfo('dummy-token', dummyReq);
      expect(result).toEqual({ sub: 'user1', email: 'test@example.com' });
      expect(global.fetch).toHaveBeenCalled();
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error message',
        status: 401
      });
      await expect(getHydraUserInfo('dummy-token', dummyReq)).rejects.toThrow(/ユーザー情報取得失敗/);
    });
  });

  describe('acceptLoginChallenge', () => {
    const dummyReq = { headers: { host: 'localhost' } };
    it('正常系: チャレンジ受け入れ成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirect_to: 'http://example.com' })
      });
      const result = await acceptLoginChallenge(dummyReq, 'challenge', 'user');
      expect(result).toEqual({ redirect_to: 'http://example.com' });
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
        status: 400
      });
      await expect(acceptLoginChallenge(dummyReq, 'challenge', 'user')).rejects.toThrow(/ログインチャレンジ受け入れ失敗/);
    });
  });

  describe('acceptConsentChallenge', () => {
    const dummyReq = { headers: { host: 'localhost' } };
    it('正常系: チャレンジ受け入れ成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirect_to: 'http://example.com' })
      });
      const result = await acceptConsentChallenge(dummyReq, 'challenge', ['openid'], { email: 'test@example.com' });
      expect(result).toEqual({ redirect_to: 'http://example.com' });
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
        status: 400
      });
      await expect(acceptConsentChallenge(dummyReq, 'challenge', ['openid'], { email: 'test@example.com' })).rejects.toThrow(/コンセントチャレンジ受け入れ失敗/);
    });
  });

  describe('getConsentRequest', () => {
    const dummyReq = { headers: { host: 'localhost' } };
    it('正常系: リクエスト取得成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subject: 'user1', requested_scope: ['openid'] })
      });
      const result = await getConsentRequest(dummyReq, 'challenge');
      expect(result).toEqual({ subject: 'user1', requested_scope: ['openid'] });
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
        status: 404
      });
      await expect(getConsentRequest(dummyReq, 'challenge')).rejects.toThrow(/コンセントリクエスト取得失敗/);
    });
  });
});
