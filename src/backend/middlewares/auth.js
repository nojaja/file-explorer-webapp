export function ensureAuthenticated(req, res, next) {
  // グローバル認証設定を参照
  // 認証なしモードの場合は常にアクセス許可
  if (global.authList && global.authList.noAuthRequired) {
    return next();
  }
  
  if (process.env.NODE_ENV === 'test') {
    // テスト環境では認証バイパス
    return next();
  }
  
  // カスタムセッション認証チェック
  if (req.session?.isAuthenticated) {
    return next();
  }
  
  // 通常のPassport認証チェック
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ error: "認証が必要です" });
}
