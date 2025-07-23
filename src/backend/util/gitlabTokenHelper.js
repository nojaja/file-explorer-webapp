// GitLabトークン取得処理のカスタムヘルパー

/**
 * GitLabからOAuth2トークンを取得するカスタム関数
 * @param {string} code - 認可コード
 * @param {string} clientId - クライアントID
 * @param {string} clientSecret - クライアントシークレット
 * @param {string} callbackUrl - コールバックURL
 * @returns {Promise<Object>} - トークン情報
 */

export async function getGitLabToken(code, clientId, clientSecret, callbackUrl, req) {
  try {
    // 内部通信用のGitLab URLを使用
    // FQDNごとの設定取得
    const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
    const { getAuthProviderConfig } = await import('../authProviderConfig.js');
    console.log('[getGitLabToken] fqdn:', fqdn, 'provider:', 'gitlab');
    const gitlabConfig = await getAuthProviderConfig(fqdn, 'gitlab');
    console.log('[getGitLabToken] gitlabConfig:', gitlabConfig);
    const gitlabInternalUrl = gitlabConfig?.GITLAB_TOKEN_URL_INTERNAL;
    const tokenEndpoint = `${gitlabInternalUrl}`;

    const requestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl
    };
    // 送信するリクエストパラメータを詳細にログ出力
    console.log('[getGitLabToken] tokenEndpoint:', tokenEndpoint);
    console.log('[getGitLabToken] requestBody:', requestBody);

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[gitlabTokenHelper] トークン取得エラー: ${response.status} ${error}`);
      throw new Error(`トークン取得失敗: ${response.status} ${error}`);
    }

    const tokenData = await response.json();
    // 取得したトークン全体を詳細にログ出力
    console.log('[getGitLabToken] tokenData:', tokenData);
    return tokenData;
  } catch (error) {
    console.error('[gitlabTokenHelper] トークン取得例外:', error);
    throw error;
  }
}

/**
 * GitLabトークンを使用してユーザー情報を取得するカスタム関数
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<Object>} - ユーザー情報
 */
export async function getGitLabUserInfo(req, accessToken) {
  try {
    // GitLabのユーザー情報エンドポイント（内部通信用）
    // FQDNごとの設定取得
    const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'localhost');
    const { getAuthProviderConfig } = await import('../authProviderConfig.js');
    console.log('[getGitLabUserInfo] fqdn:', fqdn, 'provider:', 'gitlab');
    const gitlabConfig = await getAuthProviderConfig(fqdn, 'gitlab');
    console.log('[getGitLabUserInfo] gitlabConfig:', gitlabConfig);
    const gitlabInternalUrl = gitlabConfig?.GITLAB_USERINFO_URL_INTERNAL;
    const userInfoUrl = `${gitlabInternalUrl}`;
    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[gitlabTokenHelper] ユーザー情報取得エラー: ${response.status} ${error}`);
      throw new Error(`ユーザー情報取得失敗: ${response.status} ${error}`);
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('[gitlabTokenHelper] ユーザー情報取得例外:', error);
    throw error;
  }
}
