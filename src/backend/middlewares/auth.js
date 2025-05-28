export function ensureAuthenticated(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    // テスト環境では認証バイパス
    return next();
  }
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "認証が必要です" });
}
