export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testPathIgnorePatterns: [
    '<rootDir>/test/e2e/',
    '<rootDir>/test/.*\\.spec\\.[jt]s$'
  ],
  testMatch: ['**/?(*.)+(test).[jt]s', '**/?(*.)+(test).mjs'],
  transformIgnorePatterns: [
    'node_modules/'
  ],
  preset: undefined,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
