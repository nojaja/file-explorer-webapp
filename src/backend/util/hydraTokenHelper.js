// Hydraトークン取得処理のカスタムヘルパー
import fetch from 'node-fetch';

/**
 * HydraからOAuth2トークンを取得するカスタム関数
 * @param {string} code - 認可コード
 * @param {string} clientId - クライアントID
 * @param {string} clientSecret - クライアントシークレット
 * @param {string} callbackUrl - コールバックURL
 * @param {string} state - CSRF保護用のstate値（必要な場合）
 * @returns {Promise<Object>} - トークン情報
 */
export async function getHydraToken(code, clientId, clientSecret, callbackUrl, state = null) {
  try {
    // 内部通信用のHydra URLを使用
    const hydraTokenUrl = process.env.HYDRA_TOKEN_URL_INTERNAL || 'http://hydra:4444/oauth2/token';
    
    console.log(`[hydraTokenHelper] トークン取得リクエスト: ${hydraTokenUrl}`);
    
    const requestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl
    };
    
    // stateが指定されている場合は追加
    if (state) {
      requestBody.state = state;
    }
    
    const response = await fetch(hydraTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[hydraTokenHelper] トークン取得エラー: ${response.status} ${error}`);
      throw new Error(`トークン取得失敗: ${response.status} ${error}`);
    }
    
    const tokenData = await response.json();
    console.log('[hydraTokenHelper] トークン取得成功');
    
    return tokenData;
  } catch (error) {
    console.error('[hydraTokenHelper] トークン取得例外:', error);
    throw error;
  }
}

/**
 * Hydraトークンを使用してユーザー情報を取得するカスタム関数
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<Object>} - ユーザー情報
 */
export async function getHydraUserInfo(accessToken) {
  try {
    // Hydra UserInfo エンドポイント（内部通信用）
    const hydraUserInfoUrl = process.env.HYDRA_USERINFO_URL_INTERNAL || 
                            (process.env.HYDRA_AUTH_URL_INTERNAL ? 
                              `${process.env.HYDRA_AUTH_URL_INTERNAL.replace(/\/oauth2\/auth$/, '')}/userinfo` : 
                              'http://hydra:4444/userinfo');
    
    console.log(`[hydraTokenHelper] ユーザー情報取得リクエスト: ${hydraUserInfoUrl}`);
    
    const response = await fetch(hydraUserInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[hydraTokenHelper] ユーザー情報取得エラー: ${response.status} ${error}`);
      throw new Error(`ユーザー情報取得失敗: ${response.status} ${error}`);
    }
    
    const userData = await response.json();
    console.log('[hydraTokenHelper] ユーザー情報取得成功');
    return userData;
  } catch (error) {
    console.error('[hydraTokenHelper] ユーザー情報取得例外:', error);
    throw error;
  }
}

/**
 * Hydraの管理APIを使ってログインチャレンジを受け入れる関数
 * @param {string} loginChallenge - ログインチャレンジ
 * @param {string} subject - ユーザーID
 * @returns {Promise<Object>} - 受け入れレスポンス
 */
export async function acceptLoginChallenge(loginChallenge, subject = 'test-user') {
  try {
    const hydraAdminUrl = process.env.HYDRA_ADMIN_URL || 'http://hydra:4445';
    const acceptUrl = `${hydraAdminUrl}/admin/oauth2/auth/requests/login/accept`;
    
    console.log(`[hydraTokenHelper] ログインチャレンジ受け入れリクエスト: ${acceptUrl}?login_challenge=${loginChallenge}`);
    
    const response = await fetch(`${acceptUrl}?login_challenge=${loginChallenge}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        remember: false,
        remember_for: 0,
        acr: '1'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[hydraTokenHelper] ログインチャレンジ受け入れエラー: ${response.status} ${error}`);
      throw new Error(`ログインチャレンジ受け入れ失敗: ${response.status} ${error}`);
    }
    
    const acceptData = await response.json();
    console.log('[hydraTokenHelper] ログインチャレンジ受け入れ成功');
    return acceptData;
  } catch (error) {
    console.error('[hydraTokenHelper] ログインチャレンジ受け入れ例外:', error);
    throw error;
  }
}

/**
 * Hydraの管理APIを使ってコンセントチャレンジを受け入れる関数
 * @param {string} consentChallenge - コンセントチャレンジ
 * @param {Array<string>} scopes - 承認するスコープ
 * @returns {Promise<Object>} - 受け入れレスポンス
 */
export async function acceptConsentChallenge(consentChallenge, scopes = ['openid', 'profile', 'email']) {
  try {
    const hydraAdminUrl = process.env.HYDRA_ADMIN_URL || 'http://hydra:4445';
    const acceptUrl = `${hydraAdminUrl}/admin/oauth2/auth/requests/consent/accept`;
    
    console.log(`[hydraTokenHelper] コンセントチャレンジ受け入れリクエスト: ${acceptUrl}?consent_challenge=${consentChallenge}`);
    
    const response = await fetch(`${acceptUrl}?consent_challenge=${consentChallenge}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_scope: scopes,
        grant_access_token_audience: [],
        remember: false,
        remember_for: 0,
        session: {
          id_token: {
            'name': 'test-user'
          }
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[hydraTokenHelper] コンセントチャレンジ受け入れエラー: ${response.status} ${error}`);
      throw new Error(`コンセントチャレンジ受け入れ失敗: ${response.status} ${error}`);
    }
    
    const acceptData = await response.json();
    console.log('[hydraTokenHelper] コンセントチャレンジ受け入れ成功');
    return acceptData;
  } catch (error) {
    console.error('[hydraTokenHelper] コンセントチャレンジ受け入れ例外:', error);
    throw error;
  }
}
