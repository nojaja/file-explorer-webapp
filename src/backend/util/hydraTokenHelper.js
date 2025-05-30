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

        const hydraTokenUrl = global.authConfig.hydra.HYDRA_TOKEN_URL_INTERNAL;
        const tokenEndpoint = `${hydraTokenUrl}`;

        console.log(`[hydraTokenHelper] トークン取得リクエスト: ${tokenEndpoint}`);

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

        const response = await fetch(tokenEndpoint, {
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
        const hydraUserInfoUrl = global.authConfig.hydra.HYDRA_USERINFO_URL_INTERNAL;
        const userInfoUrl = `${hydraUserInfoUrl}`;

        console.log(`[hydraTokenHelper] ユーザー情報取得リクエスト: ${userInfoUrl}`);

        const response = await fetch(userInfoUrl, {
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
        const hydraAdminUrl = global.authConfig.hydra.HYDRA_ADMIN_URL_INTERNAL;// 'http://hydra:4445'
        const acceptUrl = `${hydraAdminUrl}/admin/oauth2/auth/requests/login/accept`;

        console.log(`[hydraTokenHelper] ログインチャレンジ受け入れリクエスト: ${acceptUrl}?login_challenge=${loginChallenge}`);

        const response = await fetch(`${acceptUrl}?login_challenge=${encodeURIComponent(loginChallenge)}`, {
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
        const hydraAdminUrl = global.authConfig.hydra.HYDRA_ADMIN_URL_INTERNAL;// 'http://hydra:4445'
        const acceptUrl = `${hydraAdminUrl}/admin/oauth2/auth/requests/consent/accept`;

        console.log(`[hydraTokenHelper] コンセントチャレンジ受け入れリクエスト: ${acceptUrl}?consent_challenge=${consentChallenge}`);

        const response = await fetch(`${acceptUrl}?consent_challenge=${encodeURIComponent(consentChallenge)}`, {
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

/**
 * Hydraの管理APIを使ってコンセントチャレンジを拒否する関数
 * @param {string} consentChallenge - コンセントチャレンジ
 * @param {string} error - エラーコード
 * @param {string} errorDescription - エラーの説明
 * @returns {Promise<Object>} - 拒否レスポンス
 */
export async function rejectConsentChallenge(consentChallenge, error = 'access_denied', errorDescription = 'ユーザーが拒否しました') {
    try {
        const hydraAdminUrl = global.authConfig.hydra.HYDRA_ADMIN_URL_INTERNAL;// 'http://hydra:4445'
        const rejectUrl = `${hydraAdminUrl}/oauth2/auth/requests/consent/reject`;

        console.log(`[hydraTokenHelper] コンセントチャレンジ拒否リクエスト: ${rejectUrl}?consent_challenge=${consentChallenge}`);

        const response = await fetch(`${rejectUrl}?consent_challenge=${encodeURIComponent(consentChallenge)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error,
                error_description: errorDescription
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[hydraTokenHelper] コンセントチャレンジ拒否エラー: ${response.status} ${error}`);
            throw new Error(`コンセントチャレンジ拒否失敗: ${response.status} ${error}`);
        }

        const rejectData = await response.json();
        console.log('[hydraTokenHelper] コンセントチャレンジ拒否成功');
        return rejectData;
    } catch (error) {
        console.error('[hydraTokenHelper] コンセントチャレンジ拒否例外:', error);
        throw error;
    }
}

/**
 * Hydra管理APIを使用してコンセントリクエストの詳細を取得する
 * @param {string} consentChallenge - コンセントチャレンジ
 * @returns {Promise<Object>} - コンセントリクエスト情報
 */
export async function getConsentRequest(consentChallenge) {
    try {
        const hydraAdminUrl = global.authConfig.hydra.HYDRA_ADMIN_URL_INTERNAL;// 'http://hydra:4445'
        const requestUrl = `${hydraAdminUrl}/oauth2/auth/requests/consent`;

        console.log(`[hydraTokenHelper] コンセントリクエスト取得: ${requestUrl}?consent_challenge=${consentChallenge}`);

        const response = await fetch(`${requestUrl}?consent_challenge=${encodeURIComponent(consentChallenge)}`);

        if (!response.ok) {
            const error = await response.text();
            console.error(`[hydraTokenHelper] コンセントリクエスト取得エラー: ${response.status} ${error}`);
            throw new Error(`コンセントリクエスト取得失敗: ${response.status} ${error}`);
        }

        const requestData = await response.json();
        console.log('[hydraTokenHelper] コンセントリクエスト取得成功');
        return requestData;
    } catch (error) {
        console.error('[hydraTokenHelper] コンセントリクエスト取得例外:', error);
        throw error;
    }
}
