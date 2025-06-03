// Jest test setup - global fetch configuration
import { jest } from '@jest/globals';

// Node.js 18+ native fetch をglobalに設定
global.fetch = fetch;
