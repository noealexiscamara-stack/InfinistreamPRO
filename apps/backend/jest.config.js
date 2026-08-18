/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  moduleNameMapper: {
    '^@infiny-stream/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@infiny-stream/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
