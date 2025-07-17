
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../src/backend/authProviderConfig.js', () => ({
  getAuthProviderConfig: async (fqdn, providerName) => ({
    GITLAB_TOKEN_URL_INTERNAL: 'https://gitlab.example.com/oauth/token',
    GITLAB_USERINFO_URL_INTERNAL: 'https://gitlab.example.com/api/v4/user',
    client_id: 'test_client_id',
    client_secret: 'test_client_secret',
    redirect_uri: 'http://localhost/callback',
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    callbackUrl: 'http://localhost/callback',
    enabled: true
  })
}));

let getGitLabToken, getGitLabUserInfo;
const modPromise = import('../../src/backend/util/gitlabTokenHelper.js').then(mod => {
  getGitLabToken = mod.getGitLabToken;
  getGitLabUserInfo = mod.getGitLabUserInfo;
});

beforeAll(async () => {
  await modPromise;
});

// fetchをグローバルでmock
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('gitlabTokenHelper', () => {
  const GITLAB_TOKEN_URL_INTERNAL = 'https://gitlab.example.com/oauth/token';
  const GITLAB_USERINFO_URL_INTERNAL = 'https://gitlab.example.com/api/v4/user';

  beforeEach(() => {
    jest.clearAllMocks();
    global.authConfig = {
      gitlab: {
        GITLAB_TOKEN_URL_INTERNAL,
        GITLAB_USERINFO_URL_INTERNAL
      }
    };
  });

  describe('getGitLabToken', () => {
    const code = 'test_code';
    const clientId = 'test_client_id';
    const clientSecret = 'test_client_secret';
    const callbackUrl = 'http://localhost/callback';

    it('正常系: トークン取得成功', async () => {
      const mockToken = { access_token: 'abc', token_type: 'Bearer' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken
      });
      const dummyReq = { headers: { host: 'gitlab.example.com' } };
      const result = await getGitLabToken(code, clientId, clientSecret, callbackUrl, dummyReq);
      expect(result).toEqual(mockToken);
      expect(mockFetch).toHaveBeenCalledWith(GITLAB_TOKEN_URL_INTERNAL, expect.objectContaining({ method: 'POST' }));
    });

    it('異常系: HTTPエラー', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      });
      const dummyReq = { headers: { host: 'gitlab.example.com' } };
      await expect(getGitLabToken(code, clientId, clientSecret, callbackUrl, dummyReq)).rejects.toThrow(/トークン取得失敗/);
    });

    it('異常系: fetch例外', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));
      const dummyReq = { headers: { host: 'gitlab.example.com' } };
      await expect(getGitLabToken(code, clientId, clientSecret, callbackUrl, dummyReq)).rejects.toThrow('network error');
    });
  });

  describe('getGitLabUserInfo', () => {
    const accessToken = 'test_access_token';

    it('正常系: ユーザー情報取得成功', async () => {
      const mockUser = { id: 1, username: 'gitlabuser' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });
      const dummyReq = { headers: { host: 'gitlab.example.com' } };
      const result = await getGitLabUserInfo(dummyReq, accessToken);
      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(GITLAB_USERINFO_URL_INTERNAL, expect.objectContaining({ headers: expect.any(Object) }));
    });

    it('異常系: HTTPエラー', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });
      const dummyReq = { headers: { host: 'gitlab.example.com' } };
      await expect(getGitLabUserInfo(dummyReq, accessToken)).rejects.toThrow(/ユーザー情報取得失敗/);
    });

    it('異常系: fetch例外', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));
      const dummyReq = { headers: { host: 'gitlab.example.com' } };
      await expect(getGitLabUserInfo(dummyReq, accessToken)).rejects.toThrow('network error');
    });
  });
});
