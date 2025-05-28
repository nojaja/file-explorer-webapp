export default {
  testEnvironment: 'node',
  preset: 'default',
  extensionsToTreatAsEsm: ['.mjs'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testPathIgnorePatterns: ['<rootDir>/test/e2e/'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s', '**/?(*.)+(spec|test).mjs'],
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch)/)'
  ]
};
