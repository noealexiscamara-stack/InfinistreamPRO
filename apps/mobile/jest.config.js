/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@infiny-stream/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@infiny-stream/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@infiny-stream/config$': '<rootDir>/../../packages/config/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        types: ['jest'],
      },
    },
  },
};
