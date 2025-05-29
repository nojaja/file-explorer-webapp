// GitLabトークン取得処理のカスタムヘルパー
import fetch from 'node-fetch';

/**
 * GitLabからOAuth2トークンを取得するカスタム関数
 * @param {string} code - 認可コード
 * @param {string} clientId - クライアントID
 * @param {string} clientSecret - クライアントシークレット
 * @param {string} callbackUrl - コールバックURL
 * @returns {Promise<Object>} - トークン情報
 */
export async function getGitLabToken(code, clientId, clientSecret, callbackUrl) {
  try {
    // 内部通信用のGitLab URLを使用
    const gitlabUrl = process.env.GITLAB_URL_INTERNAL || 'http://gitlab:8929';
    const tokenEndpoint = `${gitlabUrl}/oauth/token`;
    
    console.log(`[gitlabTokenHelper] トークン取得リクエスト: ${tokenEndpoint}`);
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[gitlabTokenHelper] トークン取得エラー: ${response.status} ${error}`);
      throw new Error(`トークン取得失敗: ${response.status} ${error}`);
    }
    
    const tokenData = await response.json();
    console.log('[gitlabTokenHelper] トークン取得成功');
    return tokenData;
  } catch (error) {
    console.error('[gitlabTokenHelper] トークン取得例外:', error);
    throw error;
  }
}
