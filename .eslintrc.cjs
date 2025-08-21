module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 認知的複雑性の上限を設定
    'complexity': ['error', { max: 10 }],
    'max-params': ['warn', 4],
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['warn', { max: 200, skipComments: true }]
  }
  ,
  overrides: [
    {
      files: ["test/**/*.js", "test/**/*.mjs"],
      env: { jest: true },
      rules: {
        // テストファイルでは一部ルールを緩和
        'no-undef': 'off'
  , 'max-lines-per-function': 'off'
      }
    }
  ]
};
