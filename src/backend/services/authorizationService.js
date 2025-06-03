// 認可管理サービス - emailベースの権限制御
import fs from 'fs';
import path from 'path';

let authorizationConfig = null;

/**
 * 認可設定を初期化・読み込み
 */
export function initializeAuthorization() {
    try {
        if (fs.existsSync(global.config.authorizationConfigPath)) {
            const configData = fs.readFileSync(global.config.authorizationConfigPath, 'utf8');
            authorizationConfig = JSON.parse(configData);
            console.log('[AuthorizationService] 認可設定読み込み完了');
            console.log('[AuthorizationService] ルール数:', authorizationConfig.authorization.rules.length);
        } else {
            console.warn('[AuthorizationService] 認可設定ファイルが見つかりません:', global.config.authorizationConfigPath);
            // デフォルト設定を作成
            createDefaultConfig();
        }
    } catch (error) {
        console.error('[AuthorizationService] 認可設定読み込みエラー:', error);
        createDefaultConfig();
    }
}

/**
 * デフォルト認可設定を作成
 */
function createDefaultConfig() {
    authorizationConfig = {
        authorization: {
            rules: [
                {
                    email: "admin@example.com",
                    permission: "full",
                    description: "システム管理者"
                },
                {
                    email: "testuser@example.com",
                    permission: "full",
                    description: "テストユーザー"
                }
            ],
            defaultPermission: "denied",
            permissions: {
                full: {
                    description: "フルアクセス",
                    canView: true,
                    canDownload: true,
                    canUpload: true,
                    canDelete: true
                },
                readonly: {
                    description: "削除不可",
                    canView: true,
                    canDownload: true,
                    canUpload: true,
                    canDelete: false
                },
                denied: {
                    description: "アクセス不可",
                    canView: false,
                    canDownload: false,
                    canUpload: false,
                    canDelete: false
                }
            }
        }
    };
    console.log('[AuthorizationService] デフォルト認可設定を使用');
}

/**
 * ユーザーの権限レベルを取得
 * @param {string} email - ユーザーのメールアドレス
 * @returns {string} - 権限レベル (full/readonly/denied)
 */
export function getUserPermissionLevel(email) {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    const normalizedEmail = email.toLowerCase();
    const rule = authorizationConfig.authorization.rules.find(r => 
        r.email.toLowerCase() === normalizedEmail
    );
    
    const permissionLevel = rule ? rule.permission : authorizationConfig.authorization.defaultPermission;
    console.log(`[AuthorizationService] ${email} の権限レベル: ${permissionLevel}`);
    return permissionLevel;
}

/**
 * ユーザーの権限詳細を取得
 * @param {string} email - ユーザーのメールアドレス
 * @returns {Object} - 権限詳細オブジェクト
 */
export function getUserPermissions(email) {
    const permissionLevel = getUserPermissionLevel(email);
    const permissions = authorizationConfig.authorization.permissions[permissionLevel];
    
    return {
        level: permissionLevel,
        ...permissions
    };
}

/**
 * ユーザーが特定の操作を実行できるかチェック
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} action - 操作種別 (view/download/upload/delete)
 * @returns {boolean} - 実行可能かどうか
 */
export function canUserPerformAction(email, action) {
    const permissions = getUserPermissions(email);
    
    switch (action) {
        case 'view':
            return permissions.canView;
        case 'download':
            return permissions.canDownload;
        case 'upload':
            return permissions.canUpload;
        case 'delete':
            return permissions.canDelete;
        default:
            console.warn(`[AuthorizationService] 未知の操作: ${action}`);
            return false;
    }
}

/**
 * ユーザーのアクセス可否をチェック（認証段階で使用）
 * @param {string} email - ユーザーのメールアドレス
 * @returns {boolean} - アクセス可能かどうか
 */
export function canUserAccess(email) {
    const permissions = getUserPermissions(email);
    return permissions.canView; // ファイル一覧を見ることができるかどうか
}

/**
 * 認可設定の管理用関数群
 */

/**
 * ユーザーの権限を設定
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} permission - 権限レベル (full/readonly/denied)
 * @param {string} description - 説明
 */
export function setUserPermission(email, permission, description = '') {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    const normalizedEmail = email.toLowerCase();
    const existingIndex = authorizationConfig.authorization.rules.findIndex(r => 
        r.email.toLowerCase() === normalizedEmail
    );
    
    const rule = {
        email: normalizedEmail,
        permission,
        description
    };
    
    if (existingIndex >= 0) {
        authorizationConfig.authorization.rules[existingIndex] = rule;
        console.log(`[AuthorizationService] 権限更新: ${email} -> ${permission}`);
    } else {
        authorizationConfig.authorization.rules.push(rule);
        console.log(`[AuthorizationService] 権限追加: ${email} -> ${permission}`);
    }
    
    saveConfig();
}

/**
 * ユーザーの権限を削除
 * @param {string} email - ユーザーのメールアドレス
 */
export function removeUserPermission(email) {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    const normalizedEmail = email.toLowerCase();
    const originalLength = authorizationConfig.authorization.rules.length;
    authorizationConfig.authorization.rules = authorizationConfig.authorization.rules.filter(r => 
        r.email.toLowerCase() !== normalizedEmail
    );
    
    if (authorizationConfig.authorization.rules.length < originalLength) {
        console.log(`[AuthorizationService] 権限削除: ${email}`);
        saveConfig();
    }
}

/**
 * 全ユーザーの権限一覧を取得
 * @returns {Array} - 権限ルール一覧
 */
export function getAllPermissions() {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    return authorizationConfig.authorization.rules;
}

/**
 * 設定をファイルに保存
 */
function saveConfig() {
    try {
        // data ディレクトリが存在しない場合は作成
        const dataDir = path.dirname(global.config.authorizationConfigPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        authorizationConfig.metadata = {
            ...authorizationConfig.metadata,
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(global.config.authorizationConfigPath, JSON.stringify(authorizationConfig, null, 2), 'utf8');
        console.log('[AuthorizationService] 認可設定保存完了');
    } catch (error) {
        console.error('[AuthorizationService] 設定保存エラー:', error);
    }
}

