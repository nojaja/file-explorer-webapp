// 認証プロバイダ設定ユーティリティ
// FQDNとプロバイダ名から認証設定を取得する
import fs from 'fs';
import path from 'path';
import * as sourceMapSupport from 'source-map-support'

//デバッグ用のsourceMap設定
sourceMapSupport.install();
// 認証プロバイダー設定ファイルのパス
const CONFIG_PATH = process.env.AUTHORIZATION_PROVIDER_CONFIG_PATH || path.resolve(process.cwd(), "conf/authorization-provider-config.json");
console.log("CONFIG_PATH",CONFIG_PATH);
let configCache = null;

function loadConfig() {
  if (configCache) return configCache;
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`設定ファイルが見つかりません: ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  configCache = JSON.parse(raw);
  return configCache;
}

/**
 * FQDNとプロバイダ名から認証設定を取得する
 * @param {string} fqdn req.headers.host など
 * @param {string} providerName 'GITLAB' など（大文字）
 * @returns {object|null} 設定オブジェクト（なければnull）
 */
export function getAuthProviderConfig(fqdn, providerName) {
  const config = loadConfig();
  if (!config.providers) return null;
  // 完全一致優先、なければdefault
  const fqdnConfig = config.providers[fqdn] || {};
  let providerConfig = fqdnConfig[providerName];
  if (!providerConfig && config.providers["default"]) {
    providerConfig = config.providers["default"][providerName];
  }
  return providerConfig || null;
}

// 使用例:
// const cfg = getAuthProviderConfig(req.headers.host, 'GITLAB');
// if (cfg && cfg.enabled) { ... }
