// 認可システムのテスト
const fs = require('fs');
const path = require('path');

describe('認可システムテスト', () => {
  
  test('基本的なテスト', () => {
    // 単純な動作確認
    expect(1 + 1).toBe(2);
  });

  test('認可設定ファイルの存在確認', () => {
    // 認可設定ファイルが存在するかチェック
    const configPath = path.join(process.cwd(), 'data', 'authorization-config.json');
    const exists = fs.existsSync(configPath);
    expect(exists).toBe(true);
  });

  test('認可設定ファイルの内容確認', () => {
    // 認可設定ファイルの内容をチェック
    const configPath = path.join(process.cwd(), 'data', 'authorization-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    expect(config.authorization).toBeDefined();
    expect(config.authorization.rules).toBeDefined();
    expect(Array.isArray(config.authorization.rules)).toBe(true);
    expect(config.authorization.permissions).toBeDefined();
    expect(config.authorization.permissions.full).toBeDefined();
    expect(config.authorization.permissions.readonly).toBeDefined();
    expect(config.authorization.permissions.denied).toBeDefined();
  });
});
