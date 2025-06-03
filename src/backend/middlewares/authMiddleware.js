// 認証・認可ミドルウェア
import { getHydraUserInfo } from "../util/hydraTokenHelper.js";
import { isEmailAuthorized, getUserByEmail } from "../services/userService.js";

/**
 * OAuth認証チェックミドルウェア
 * リクエストヘッダーのAuthorizationトークンをチェックして認証状態を確認
 */
export async function authMiddleware(req, res, next) {
    // 認証が無効な場合はスキップ
    if (global.authList.noAuthRequired) {
        console.log('[authMiddleware] 認証なしモード');
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[authMiddleware] 認証ヘッダーが見つかりません');
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: '認証が必要です。ログインしてください。' 
        });
    }

    const token = authHeader.substring(7); // 'Bearer ' を除去

    try {
        // Hydraからユーザー情報を取得
        const userInfo = await getHydraUserInfo(token);
        console.log('[authMiddleware] ユーザー情報取得成功:', userInfo);
        
        // ユーザー情報をリクエストに追加
        req.user = userInfo;
        req.accessToken = token;
        
        next();
    } catch (error) {
        console.error('[authMiddleware] 認証エラー:', error);
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: '無効な認証トークンです。再度ログインしてください。' 
        });
    }
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
