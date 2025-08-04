/**
 * Jest configuration for Windows Internal Commands tests
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/windows-internal-commands.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // 30 seconds for each test
  verbose: true,
  collectCoverage: false,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Only run on Windows
  testPathIgnorePatterns: process.platform !== 'win32' ? ['.*'] : [],
};
