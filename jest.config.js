export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.cjs' }]
  },
  moduleFileExtensions: ['js', 'mjs', 'json'],
  setupFilesAfterEnv: ['./test/setup.js'],
  verbose: true,
  testMatch: ['<rootDir>/test/unit/**/*.test.js']
}
