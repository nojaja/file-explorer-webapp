import * as authz from '../../src/backend/services/authorizationService.js';

describe('authorizationService', () => {
  beforeEach(() => {
    // テスト用の認可設定を初期化
    authz.initializeAuthorization();
  });

  it('getRootPathsでROOT_PATH一覧取得', () => {
    const rootPaths = authz.getRootPaths();
    expect(Array.isArray(rootPaths)).toBe(true);
  });

  it('getDefaultRootPathでデフォルトROOT_PATH取得', () => {
    const def = authz.getDefaultRootPath();
    expect(def).not.toBeNull();
  });

  it('getRootPathByIdでIDからパス取得', () => {
    const rootPaths = authz.getRootPaths();
    if (rootPaths.length > 0) {
      const id = rootPaths[0].id;
      const path = authz.getRootPathById(id);
      expect(typeof path).toBe('string');
    }
  });

  it('getUserAccessibleRootPathsでユーザーのアクセス可能ROOT_PATH取得', () => {
    const rootPaths = authz.getRootPaths();
    if (rootPaths.length > 0) {
      const email = Object.keys((rootPaths[0].permissions || {}))[0] || 'test@example.com';
      const result = authz.getUserAccessibleRootPaths(email);
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('getUserPermissionsで権限オブジェクト取得', () => {
    const rootPaths = authz.getRootPaths();
    if (rootPaths.length > 0) {
      const id = rootPaths[0].id;
      const email = Object.keys((rootPaths[0].permissions || {}))[0] || 'test@example.com';
      const perms = authz.getUserPermissions(email, id);
      expect(perms).toHaveProperty('canView');
    }
  });
});
