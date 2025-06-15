// 認可管理サービス - emailベースの権限制御（複数ROOT_PATH対応）
import fs from 'fs';
import path from 'path';

let authorizationConfig = null;

/**
 * 認可設定を初期化・読み込み
 */
export function initializeAuthorization() {
    try {
        const configPath = path.resolve(global.config.authorizationConfigPath);
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            authorizationConfig = JSON.parse(configData);
            console.log('[AuthorizationService] 認可設定読み込み完了');
            console.log('[AuthorizationService] ルール数:', authorizationConfig.authorization.rules.length);
            console.log('[AuthorizationService] ROOT_PATH数:', authorizationConfig.rootPaths?.length || 0);
        } else {
            console.warn('[AuthorizationService] 認可設定ファイルが見つかりません:', configPath);
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
        rootPaths: [
            {
                id: "main",
                name: "メインデータ",
                path: "./data",
                description: "メインのデータディレクトリ",
                isDefault: true
            }
        ],
        authorization: {
            rules: [
                {
                    email: "admin@example.com",
                    rootPathPermissions: {
                        "main": "full"
                    },
                    description: "システム管理者"
                },
                {
                    email: "testuser@example.com",
                    rootPathPermissions: {
                        "main": "full"
                    },
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
        },
        metadata: {
            version: "2.0.0",
            lastUpdated: new Date().toISOString(),
            description: "ファイルエクスプローラーWebアプリケーション認可設定 - 複数ROOT_PATH対応版"
        }
    };
    console.log('[AuthorizationService] デフォルト認可設定を使用');
}

/**
 * 利用可能なROOT_PATH一覧を取得
 * @returns {Array} - ROOT_PATH一覧
 */
export function getRootPaths() {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    return authorizationConfig.rootPaths || [];
}

/**
 * デフォルトROOT_PATHを取得
 * @returns {Object|null} - デフォルトROOT_PATHオブジェクト
 */
export function getDefaultRootPath() {
    const rootPaths = getRootPaths();
    return rootPaths.find(rp => rp.isDefault) || rootPaths[0] || null;
}

/**
 * ROOT_PATH IDから実際のパスを取得
 * @param {string} rootPathId - ROOT_PATH ID
 * @returns {string|null} - 実際のパス
 */
export function getRootPathById(rootPathId) {
    const rootPaths = getRootPaths();
    const rootPath = rootPaths.find(rp => rp.id === rootPathId);
    return rootPath ? rootPath.path : null;
}

/**
 * ユーザーがアクセス可能なROOT_PATH一覧を取得
 * @param {string} email - ユーザーのメールアドレス
 * @returns {Array} - アクセス可能なROOT_PATH一覧
 */
export function getUserAccessibleRootPaths(email) {
    const rootPaths = getRootPaths();
    const userRule = getUserRule(email);
    
    if (!userRule || !userRule.rootPathPermissions) {
        return []; // アクセス権限がない場合は空配列
    }
    
    return rootPaths.filter(rp => {
        const permission = userRule.rootPathPermissions[rp.id];
        return permission && permission !== 'denied';
    }).map(rp => ({
        ...rp,
        permission: userRule.rootPathPermissions[rp.id]
    }));
}

/**
 * ユーザーの権限ルールを取得
 * @param {string} email - ユーザーのメールアドレス
 * @returns {Object|null} - 権限ルール
 */
function getUserRule(email) {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    const normalizedEmail = email.toLowerCase();
    return authorizationConfig.authorization.rules.find(r => 
        r.email.toLowerCase() === normalizedEmail
    );
}

/**
 * ユーザーの特定ROOT_PATHでの権限レベルを取得
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} rootPathId - ROOT_PATH ID
 * @returns {string} - 権限レベル (full/readonly/denied)
 */
export function getUserPermissionLevel(email, rootPathId) {
    const rule = getUserRule(email);
    
    if (!rule || !rule.rootPathPermissions) {
        console.log(`[AuthorizationService] ${email} の ${rootPathId} 権限レベル: ${authorizationConfig.authorization.defaultPermission} (デフォルト)`);
        return authorizationConfig.authorization.defaultPermission;
    }
    
    const permissionLevel = rule.rootPathPermissions[rootPathId] || authorizationConfig.authorization.defaultPermission;
    console.log(`[AuthorizationService] ${email} の ${rootPathId} 権限レベル: ${permissionLevel}`);
    return permissionLevel;
}

/**
 * ユーザーの特定ROOT_PATHでの権限詳細を取得
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} rootPathId - ROOT_PATH ID
 * @returns {Object} - 権限詳細オブジェクト
 */
export function getUserPermissions(email, rootPathId = null) {
    // 後方互換性: rootPathIdが指定されていない場合はデフォルトROOT_PATHを使用
    if (!rootPathId) {
        const defaultRootPath = getDefaultRootPath();
        rootPathId = defaultRootPath ? defaultRootPath.id : null;
    }
    
    if (!rootPathId) {
        return {
            level: 'denied',
            canView: false,
            canDownload: false,
            canUpload: false,
            canDelete: false
        };
    }
    
    const permissionLevel = getUserPermissionLevel(email, rootPathId);
    const permissions = authorizationConfig.authorization.permissions[permissionLevel];
    
    return {
        level: permissionLevel,
        rootPathId: rootPathId,
        ...permissions
    };
}

/**
 * ユーザーが特定ROOT_PATHで特定の操作を実行できるかチェック
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} action - 操作種別 (view/download/upload/delete)
 * @param {string} rootPathId - ROOT_PATH ID
 * @returns {boolean} - 実行可能かどうか
 */
export function canUserPerformAction(email, action, rootPathId = null) {
    const permissions = getUserPermissions(email, rootPathId);
    
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
 * ユーザーの特定ROOT_PATHへのアクセス可否をチェック（認証段階で使用）
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} rootPathId - ROOT_PATH ID
 * @returns {boolean} - アクセス可能かどうか
 */
export function canUserAccess(email, rootPathId = null) {
    const permissions = getUserPermissions(email, rootPathId);
    return permissions.canView; // ファイル一覧を見ることができるかどうか
}

/**
 * 認可設定の管理用関数群
 */

/**
 * ユーザーの特定ROOT_PATHでの権限を設定
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} rootPathId - ROOT_PATH ID
 * @param {string} permission - 権限レベル (full/readonly/denied)
 * @param {string} description - 説明
 */
export function setUserRootPathPermission(email, rootPathId, permission, description = '') {
    if (!authorizationConfig) {
        initializeAuthorization();
    }
    
    const normalizedEmail = email.toLowerCase();
    let rule = getUserRule(normalizedEmail);
    
    if (!rule) {
        rule = {
            email: normalizedEmail,
            rootPathPermissions: {},
            description: description || `${email}の権限設定`
        };
        authorizationConfig.authorization.rules.push(rule);
    }
    
    if (!rule.rootPathPermissions) {
        rule.rootPathPermissions = {};
    }
    
    rule.rootPathPermissions[rootPathId] = permission;
    
    if (description) {
        rule.description = description;
    }
    
    console.log(`[AuthorizationService] 権限設定: ${email} の ${rootPathId} -> ${permission}`);
    saveConfig();
}

/**
 * ユーザーの権限を設定（後方互換性）
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} permission - 権限レベル (full/readonly/denied)
 * @param {string} description - 説明
 */
export function setUserPermission(email, permission, description = '') {
    const defaultRootPath = getDefaultRootPath();
    if (defaultRootPath) {
        setUserRootPathPermission(email, defaultRootPath.id, permission, description);
    }
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
        const configPath = path.resolve(global.config.authorizationConfigPath);
        // data ディレクトリが存在しない場合は作成
        const dataDir = path.dirname(configPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        authorizationConfig.metadata = {
            ...authorizationConfig.metadata,
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(configPath, JSON.stringify(authorizationConfig, null, 2), 'utf8');
        console.log('[AuthorizationService] 認可設定保存完了');
    } catch (error) {
        console.error('[AuthorizationService] 設定保存エラー:', error);
    }
}

