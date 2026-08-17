/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@infiny-stream/types$': '<rootDir>/../types/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
