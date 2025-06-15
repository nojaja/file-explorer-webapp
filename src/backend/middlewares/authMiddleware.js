// 認証・認可ミドルウェア
import { getHydraUserInfo } from "../util/hydraTokenHelper.js";
import { isEmailAuthorized, getUserByEmail } from "../services/userService.js";
import { canUserAccess, canUserPerformAction, getUserPermissions } from "../services/authorizationService.js";

/**
 * OAuth認証チェックミドルウェア
 * リクエストヘッダーのAuthorizationトークンをチェックして認証状態を確認
 */
export async function authMiddleware(req, res, next) {
    console.log('[authMiddleware] req.headers.cookie:', req.headers.cookie);

    // 認証が無効な場合はスキップ
    if (global.authList.noAuthRequired) {
        console.log('[authMiddleware] 認証なしモード');
        return next();
    }

    // セッション認証（GitLab, GitHub, Hydraのいずれか）
    if (req.isAuthenticated && req.isAuthenticated()) {
        console.log('[authMiddleware] セッション認証OK:', req.user);
        return next();
    }
    if (req.session && req.session.user) {
        console.log('[authMiddleware] セッションuser認証OK:', req.session.user);
        req.user = req.session.user;
        return next();
    }

    // Bearerトークン認証（Hydra用）
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const userInfo = await getHydraUserInfo(token);
            console.log('[authMiddleware] Bearer認証OK:', userInfo);
            req.user = userInfo;
            req.accessToken = token;
            return next();
        } catch (error) {
            console.error('[authMiddleware] Bearer認証エラー:', error);
        }
    }

    // どちらもなければ401
    console.log('[authMiddleware] 認証情報なし');
    return res.status(401).json({
        error: 'Unauthorized',
        message: '認証が必要です。ログインしてください。'
    });
}

/**
 * Email認可チェックミドルウェア
 * ユーザーのEmailアドレスが許可リストに含まれているかチェック
 */
export async function emailAuthorizationMiddleware(req, res, next) {
    // 認証が無効な場合はスキップ
    if (global.authList.noAuthRequired) {
        console.log('[emailAuthorizationMiddleware] 認証なしモード');
        return next();
    }

    // 認証ミドルウェアが先に実行されていることを確認
    if (!req.user) {
        console.error('[emailAuthorizationMiddleware] ユーザー情報が見つかりません');
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: '認証情報が不正です。' 
        });
    }

    const userEmail = req.user.email;
    if (!userEmail) {
        console.error('[emailAuthorizationMiddleware] ユーザーにEmailアドレスが設定されていません');
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Emailアドレスが設定されていないため、アクセスできません。' 
        });
    }

    // Email認可チェック
    const isAuthorized = isEmailAuthorized(userEmail);
    if (!isAuthorized) {
        console.warn(`[emailAuthorizationMiddleware] 許可されていないEmailアドレス: ${userEmail}`);
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: `アクセスが拒否されました。Emailアドレス「${userEmail}」は許可されていません。` 
        });
    }

    console.log(`[emailAuthorizationMiddleware] Email認可成功: ${userEmail}`);
    
    // ローカルユーザー情報も取得してリクエストに追加
    const localUser = getUserByEmail(userEmail);
    if (localUser) {
        req.localUser = localUser;
    }

    next();
}

/**
 * 統合認証ミドルウェア（認証 + Email認可）
 */
export async function fullAuthMiddleware(req, res, next) {
    await authMiddleware(req, res, async (err) => {
        if (err) return next(err);
        await emailAuthorizationMiddleware(req, res, next);
    });
}

/**
 * 管理者認証ミドルウェア（特定の管理者Emailのみ許可）
 */
export async function adminAuthMiddleware(req, res, next) {
    await fullAuthMiddleware(req, res, (err) => {
        if (err) return next(err);
        
        const adminEmails = [
            'admin@example.com',
            'admin@localhost'
        ];
        
        const userEmail = req.user?.email?.toLowerCase();
        if (!adminEmails.includes(userEmail)) {
            console.warn(`[adminAuthMiddleware] 管理者権限なし: ${userEmail}`);
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: '管理者権限が必要です。' 
            });
        }
        
        console.log(`[adminAuthMiddleware] 管理者認証成功: ${userEmail}`);
        next();
    });
}

/**
 * 新しい認可システム用ミドルウェア
 */

/**
 * 基本アクセス認可ミドルウェア（認証 + アクセス権チェック）
 * 「アクセス不可」ユーザーをブロック
 */
export async function accessAuthorizationMiddleware(req, res, next) {
    // 認証が無効な場合はスキップ
    if (global.authList.noAuthRequired) {
        console.log('[accessAuthorizationMiddleware] 認証なしモード');
        return next();
    }    let userEmail = null;

    // セッションベース認証のチェック
    if (req.session && req.session.isAuthenticated && req.session.user) {
        // Hydra認証の場合（profileオブジェクト内にemail）
        if (req.session.user.profile && req.session.user.profile.email) {
            userEmail = req.session.user.profile.email;
            console.log('[accessAuthorizationMiddleware] Hydraセッション認証でユーザー情報取得:', userEmail);
        }
        // GitLab認証の場合（直接emailプロパティ）
        else if (req.session.user.email) {
            userEmail = req.session.user.email;
            console.log('[accessAuthorizationMiddleware] GitLabセッション認証でユーザー情報取得:', userEmail);
        } else {
            console.log('[accessAuthorizationMiddleware] セッションユーザー構造:', {
                hasProfile: !!req.session.user.profile,
                hasDirectEmail: !!req.session.user.email,
                sessionUser: req.session.user
            });
        }
    }
    // トークンベース認証のチェック（API直接アクセス等）
    else if (req.user && req.user.email) {
        userEmail = req.user.email;
        console.log('[accessAuthorizationMiddleware] トークン認証でユーザー情報取得:', userEmail);
    }

    // ユーザー情報が見つからない場合
    if (!userEmail) {
        console.error('[accessAuthorizationMiddleware] ユーザー情報が見つかりません');
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: '認証情報が不正です。再度ログインしてください。' 
        });
    }

    // アクセス権チェック（viewアクセス）
    const canAccess = canUserAccess(userEmail);
    if (!canAccess) {
        console.warn(`[accessAuthorizationMiddleware] アクセス拒否: ${userEmail}`);
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: `アクセスが拒否されました。Emailアドレス「${userEmail}」にはアクセス権限がありません。` 
        });
    }

    console.log(`[accessAuthorizationMiddleware] アクセス認可成功: ${userEmail}`);
    
    // ユーザーの権限情報をリクエストに追加
    const permissions = getUserPermissions(userEmail);
    req.userPermissions = permissions;
    
    // ローカルユーザー情報も取得してリクエストに追加
    const localUser = getUserByEmail(userEmail);
    if (localUser) {
        req.localUser = localUser;
    }

    // ユーザー情報をリクエストに追加（統一性のため）
    if (!req.user) {
        req.user = req.session.user;
    }

    next();
}

/**
 * 操作権限チェックミドルウェア生成関数
 * @param {string} action - チェックする操作 (view/download/upload/delete)
 * @returns {Function} - ミドルウェア関数
 */
export function createActionAuthorizationMiddleware(action) {
    return async (req, res, next) => {
        // 認証が無効な場合はスキップ
        if (global.authList.noAuthRequired) {
            console.log(`[actionAuthMiddleware:${action}] 認証なしモード`);
            return next();
        }        let userEmail = null;

        // セッションベース認証のチェック
        if (req.session && req.session.isAuthenticated && req.session.user) {
            // Hydra認証の場合（profileオブジェクト内にemail）
            if (req.session.user.profile && req.session.user.profile.email) {
                userEmail = req.session.user.profile.email;
            }
            // GitLab認証の場合（直接emailプロパティ）
            else if (req.session.user.email) {
                userEmail = req.session.user.email;
            }
        }
        // トークンベース認証のチェック（API直接アクセス等）
        else if (req.user && req.user.email) {
            userEmail = req.user.email;
        }

        // ユーザー情報が見つからない場合
        if (!userEmail) {
            console.error(`[actionAuthMiddleware:${action}] ユーザー情報が不正です`);
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: '認証情報が不正です。' 
            });
        }

        const canPerform = canUserPerformAction(userEmail, action);
        
        if (!canPerform) {
            console.warn(`[actionAuthMiddleware:${action}] 操作権限なし: ${userEmail}`);
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: `この操作は許可されていません。権限が不足しています。` 
            });
        }

        console.log(`[actionAuthMiddleware:${action}] 操作認可成功: ${userEmail}`);
        next();
    };
}

/**
 * 統合認証・認可ミドルウェア（認証 + アクセス権限）
 */
export async function fullAccessAuthMiddleware(req, res, next) {
    await authMiddleware(req, res, async (err) => {
        if (err) return next(err);
        await accessAuthorizationMiddleware(req, res, next);
    });
}
