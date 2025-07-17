// Jest test setup - global fetch configuration
// Node.js 18+ native fetch をglobalに設定
import fetch from 'node-fetch';
global.fetch = fetch;
