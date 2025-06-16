// Jestユニットテスト: hydraTokenHelper.js
import { jest } from '@jest/globals';
import {
  getHydraUserInfo,
  acceptLoginChallenge,
  acceptConsentChallenge,
  getConsentRequest
} from '../../src/backend/util/hydraTokenHelper.js';

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
    it('正常系: ユーザー情報取得成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'user1', email: 'test@example.com' })
      });
      const result = await getHydraUserInfo('dummy-token');
      expect(result).toEqual({ sub: 'user1', email: 'test@example.com' });
      expect(global.fetch).toHaveBeenCalled();
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error message',
        status: 401
      });
      await expect(getHydraUserInfo('dummy-token')).rejects.toThrow('ユーザー情報取得失敗');
    });
  });

  describe('acceptLoginChallenge', () => {
    it('正常系: チャレンジ受け入れ成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirect_to: 'http://example.com' })
      });
      const result = await acceptLoginChallenge('challenge', 'user');
      expect(result).toEqual({ redirect_to: 'http://example.com' });
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
        status: 400
      });
      await expect(acceptLoginChallenge('challenge', 'user')).rejects.toThrow('ログインチャレンジ受け入れ失敗');
    });
  });

  describe('acceptConsentChallenge', () => {
    it('正常系: チャレンジ受け入れ成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ redirect_to: 'http://example.com' })
      });
      const result = await acceptConsentChallenge('challenge', ['openid'], { email: 'test@example.com' });
      expect(result).toEqual({ redirect_to: 'http://example.com' });
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
        status: 400
      });
      await expect(acceptConsentChallenge('challenge', ['openid'], { email: 'test@example.com' })).rejects.toThrow('コンセントチャレンジ受け入れ失敗');
    });
  });

  describe('getConsentRequest', () => {
    it('正常系: リクエスト取得成功', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subject: 'user1', requested_scope: ['openid'] })
      });
      const result = await getConsentRequest('challenge');
      expect(result).toEqual({ subject: 'user1', requested_scope: ['openid'] });
    });
    it('異常系: fetch失敗', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
        status: 404
      });
      await expect(getConsentRequest('challenge')).rejects.toThrow('コンセントリクエスト取得失敗');
    });
  });
});
