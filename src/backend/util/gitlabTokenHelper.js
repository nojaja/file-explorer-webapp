// GitLabトークン取得処理のカスタムヘルパー

/**
 * GitLabからOAuth2トークンを取得するカスタム関数
 * @param {string} code - 認可コード
 * @param {string} clientId - クライアントID
 * @param {string} clientSecret - クライアントシークレット
 * @param {string} callbackUrl - コールバックURL
 * @returns {Promise<Object>} - トークン情報
 */

export async function getGitLabToken(options) {
  try {
    // Accept single options object for clarity: { code, clientId, clientSecret, callbackUrl, req }
    const opts = options || {};
    let { code, clientId, clientSecret, callbackUrl, req } = opts;
    // 内部通信用のGitLab URLを使用
    // FQDNごとの設定取得
    // テスト時にglobal.authConfigが設定されている場合はそれを優先する
  const fqdn = req?.headers?.host || (typeof window !== 'undefined' ? window.location.host : 'default');
  const gitlabConfig = await _resolveGitLabConfig(fqdn);
  const gitlabInternalUrl = gitlabConfig?.GITLAB_TOKEN_URL_INTERNAL || gitlabConfig?.GITLAB_TOKEN_URL || gitlabConfig?.GITLAB_TOKEN_URL_PUBLIC;
  if (!gitlabInternalUrl) throw new Error('GitLab token endpoint が見つかりません');
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
  const gitlabConfig = await _resolveGitLabConfig(fqdn);
  const gitlabInternalUrl = gitlabConfig?.GITLAB_USERINFO_URL_INTERNAL || gitlabConfig?.GITLAB_USERINFO_URL || gitlabConfig?.GITLAB_USERINFO_URL_PUBLIC;
  if (!gitlabInternalUrl) throw new Error('GitLab userinfo endpoint が見つかりません');
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

async function _resolveGitLabConfig(fqdn) {
  let gitlabConfig = null;
  try {
    const { getAuthProviderConfig } = await import('../authProviderConfig.js');
    console.log('[gitlabTokenHelper] resolve config for fqdn:', fqdn);
    gitlabConfig = await getAuthProviderConfig(fqdn, 'gitlab');
    console.log('[gitlabTokenHelper] got config:', gitlabConfig);
  } catch (e) {
    console.warn('[gitlabTokenHelper] authProviderConfigの読み込み失敗:', e.message);
  }
  if (global.authConfig && global.authConfig.gitlab) {
    console.log('[gitlabTokenHelper] global.authConfig を優先使用しています');
    gitlabConfig = global.authConfig.gitlab;
  }
  return gitlabConfig || {};
}
