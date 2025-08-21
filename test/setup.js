// Jest test setup - global fetch configuration and runtime polyfills
// Node.js 18+ native fetch を使うこともできるが、ここではnode-fetchを利用して互換性を確保
// setup.js は Jest の実行コンテキストで同期的に実行されるため CommonJS require を使う
const fetch = require('node-fetch');
if (!global.fetch) {
	global.fetch = fetch;
}

// TextEncoder/TextDecoder は一部のライブラリで必要
if (typeof global.TextEncoder === 'undefined') {
	try {
		const { TextEncoder, TextDecoder } = require('util');
		global.TextEncoder = TextEncoder;
		global.TextDecoder = TextDecoder;
	} catch (err) {
		console.warn('[setup] TextEncoder/TextDecoder のポリフィルに失敗:', err.message);
	}
}

// テストで使うグローバルな認可リストを最小限用意
if (typeof global.authList === 'undefined') {
	global.authList = {
	noAuthRequired: true,
		// その他必要なデフォルト値を追加
	};
}

// テストから注入される可能性のあるglobal.authConfigの安全なデフォルト
if (typeof global.authConfig === 'undefined') {
	global.authConfig = {};
}
