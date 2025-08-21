// ユーザーサービスのユニットテスト
import {
  initializeAllowedEmails,
  registerUser,
  loginUser,
  isEmailAuthorized,
  getUserByEmail,
  getAllUsers,
  getAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail
} from '../../src/backend/services/userService.js';

describe('userService', () => {
  beforeEach(() => {
    initializeAllowedEmails();
  });

  it('registerUserとgetUserByEmailでユーザー登録・取得できる', () => {
    const result = registerUser('testuser', 'test@example.com');
    expect(result.success).toBe(true);
    const user = getUserByEmail('test@example.com');
    expect(user).not.toBeNull();
    expect(user.username).toBe('testuser');
  });

  it('loginUserで認可済みメールならisAuthorized=true', () => {
    addAllowedEmail('auth@example.com');
    const result = loginUser('authuser', 'auth@example.com');
    expect(result.isAuthorized).toBe(true);
  });

  it('isEmailAuthorizedで許可メール判定', () => {
    addAllowedEmail('ok@example.com');
    expect(isEmailAuthorized('ok@example.com')).toBe(true);
    expect(isEmailAuthorized('ng@example.com')).toBe(false);
  });

  it('getAllUsersで全ユーザー取得', () => {
    registerUser('a', 'a@example.com');
    registerUser('b', 'b@example.com');
    const users = getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
  });

  it('getAllowedEmailsで許可リスト取得', () => {
    addAllowedEmail('x@example.com');
    expect(getAllowedEmails()).toContain('x@example.com');
  });

  it('removeAllowedEmailで許可リストから削除', () => {
    addAllowedEmail('del@example.com');
    removeAllowedEmail('del@example.com');
    expect(isEmailAuthorized('del@example.com')).toBe(false);
  });
});
