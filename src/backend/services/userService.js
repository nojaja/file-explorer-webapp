// ユーザー管理サービス（簡易実装）
// 実際のプロダクション環境では、データベースやRedisなどを使用

const users = new Map(); // メモリ内ユーザーストレージ
const allowedEmails = new Set(); // 許可されたEmailアドレス

// --- Functional Domain Modeling 型定義 ---
/** @typedef {string & { readonly brand: 'UserId' }} UserId */
/** @typedef {string & { readonly brand: 'Email' }} Email */
/**
 * ユーザー型
 * @typedef {Object} User
 * @property {UserId} id
 * @property {string} username
 * @property {Email} email
 * @property {string} registeredAt
 * @property {string|null} lastLoginAt
 */
/**
 * 成功/失敗を表すResult型
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: Error }} Result
 */

// --- スマートコンストラクタ: Email検証 ---
function createEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { ok: false, error: new Error('有効なメールアドレス形式で入力してください') };
  }
  return { ok: true, value: email.toLowerCase() };
}

// --- スマートコンストラクタ: UserId生成 ---
function createUserId(username) {
  return `${username}_${Date.now()}`;
}

// --- 純粋関数: ユーザー生成 ---
function createUser(username, email) {
  const emailResult = createEmail(email);
  if (!username || !emailResult.ok) {
    return { ok: false, error: new Error('ユーザー名と有効なメールアドレスは必須です') };
  }
  /** @type {User} */
  const user = {
    id: createUserId(username),
    username,
    email: emailResult.value,
    registeredAt: new Date().toISOString(),
    lastLoginAt: null
  };
  return { ok: true, value: user };
}

// --- 認可判定の純粋関数化 ---
function isEmailAuthorizedPure(email) {
  return allowedEmails.has(email.toLowerCase());
}

// --- 許可されたEmailアドレスを設定（初期化）
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
  const userResult = createUser(username, email);
  if (!userResult.ok) throw userResult.error;
  const user = userResult.value;
  users.set(user.id, user);
  console.log('[UserService] ユーザー登録:', user);
  return {
    success: true,
    user,
    isAuthorized: isEmailAuthorizedPure(user.email)
  };
}

/**
 * ユーザーログイン処理
 * @param {string} username - ユーザー名
 * @param {string} email - メールアドレス
 * @returns {Object} - ログイン結果
 */
export function loginUser(username, email) {
  const emailResult = createEmail(email);
  if (!emailResult.ok) throw emailResult.error;
  const normalizedEmail = emailResult.value;
  let existingUser = null;
  for (const user of users.values()) {
    if (user.email === normalizedEmail || user.username === username) {
      existingUser = user;
      break;
    }
  }
  if (!existingUser) {
    return registerUser(username, normalizedEmail);
  }
  existingUser.lastLoginAt = new Date().toISOString();
  existingUser.email = normalizedEmail;
  existingUser.username = username;
  console.log('[UserService] ユーザーログイン:', existingUser);
  return {
    success: true,
    user: existingUser,
    isAuthorized: isEmailAuthorizedPure(normalizedEmail)
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


