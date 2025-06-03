// ユーザー管理サービス（簡易実装）
// 実際のプロダクション環境では、データベースやRedisなどを使用

const users = new Map(); // メモリ内ユーザーストレージ
const allowedEmails = new Set(); // 許可されたEmailアドレス

/**
 * 許可されたEmailアドレスを設定（初期化）
 */
export function initializeAllowedEmails() {
    // 環境変数から許可メールアドレスを読み込み
    const allowedEmailsEnv = process.env.ALLOWED_EMAILS || '';
    const emailList = allowedEmailsEnv.split(',').map(email => email.trim()).filter(email => email);
      // デフォルトで管理者メールを追加
    const defaultEmails = [];
    
    [...defaultEmails, ...emailList].forEach(email => {
        allowedEmails.add(email.toLowerCase());
    });
    
    console.log('[UserService] 許可されたEmailアドレス:', Array.from(allowedEmails));
}

/**
 * ユーザーを登録する
 * @param {string} username - ユーザー名
 * @param {string} email - メールアドレス
 * @returns {Object} - 登録結果
 */
export function registerUser(username, email) {
    if (!username || !email) {
        throw new Error('ユーザー名とメールアドレスは必須です');
    }
    
    // Email形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('有効なメールアドレス形式で入力してください');
    }
    
    const normalizedEmail = email.toLowerCase();
    const userId = `${username}_${Date.now()}`;
    
    const user = {
        id: userId,
        username,
        email: normalizedEmail,
        registeredAt: new Date().toISOString(),
        lastLoginAt: null
    };
    
    users.set(userId, user);
    console.log('[UserService] ユーザー登録:', user);
    
    return {
        success: true,
        user,
        isAuthorized: isEmailAuthorized(normalizedEmail)
    };
}

/**
 * ユーザーログイン処理
 * @param {string} username - ユーザー名
 * @param {string} email - メールアドレス
 * @returns {Object} - ログイン結果
 */
export function loginUser(username, email) {
    const normalizedEmail = email.toLowerCase();
    
    // 既存ユーザーを検索（email or usernameで）
    let existingUser = null;
    for (const user of users.values()) {
        if (user.email === normalizedEmail || user.username === username) {
            existingUser = user;
            break;
        }
    }
    
    // 既存ユーザーがいない場合は新規登録
    if (!existingUser) {
        return registerUser(username, email);
    }
    
    // 既存ユーザーの場合はログイン時刻を更新
    existingUser.lastLoginAt = new Date().toISOString();
    existingUser.email = normalizedEmail; // Email更新（大文字小文字の統一など）
    existingUser.username = username; // ユーザー名更新
    
    console.log('[UserService] ユーザーログイン:', existingUser);
    
    return {
        success: true,
        user: existingUser,
        isAuthorized: isEmailAuthorized(normalizedEmail)
    };
}

/**
 * Emailアドレスが認可されているかチェック
 * @param {string} email - メールアドレス
 * @returns {boolean} - 認可されているかどうか
 */
export function isEmailAuthorized(email) {
    const normalizedEmail = email.toLowerCase();
    return allowedEmails.has(normalizedEmail);
}

/**
 * ユーザー情報を取得
 * @param {string} userId - ユーザーID
 * @returns {Object|null} - ユーザー情報
 */
export function getUser(userId) {
    return users.get(userId) || null;
}

/**
 * Emailでユーザーを検索
 * @param {string} email - メールアドレス
 * @returns {Object|null} - ユーザー情報
 */
export function getUserByEmail(email) {
    const normalizedEmail = email.toLowerCase();
    for (const user of users.values()) {
        if (user.email === normalizedEmail) {
            return user;
        }
    }
    return null;
}

/**
 * 全ユーザー一覧を取得（管理用）
 * @returns {Array} - ユーザー一覧
 */
export function getAllUsers() {
    return Array.from(users.values());
}

/**
 * 許可されたEmailアドレス一覧を取得
 * @returns {Array} - 許可されたEmailアドレス一覧
 */
export function getAllowedEmails() {
    return Array.from(allowedEmails);
}

/**
 * 許可されたEmailアドレスを追加
 * @param {string} email - 追加するメールアドレス
 */
export function addAllowedEmail(email) {
    const normalizedEmail = email.toLowerCase();
    allowedEmails.add(normalizedEmail);
    console.log('[UserService] 許可Emailアドレス追加:', normalizedEmail);
}

/**
 * 許可されたEmailアドレスを削除
 * @param {string} email - 削除するメールアドレス
 */
export function removeAllowedEmail(email) {
    const normalizedEmail = email.toLowerCase();
    allowedEmails.delete(normalizedEmail);
    console.log('[UserService] 許可Emailアドレス削除:', normalizedEmail);
}


