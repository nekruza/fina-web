const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  // API route handlers run on the server, so `node` is the correct default.
  // Browser-facing modules (hooks, react-query, analytics) opt in per-file with
  // a `@jest-environment jsdom` docblock.
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // The Playwright specs also end in .spec.ts, which Jest's default testMatch
  // would happily pick up and then fail on. They belong to `npm run e2e`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],

  // Reset call history between tests so suites can't leak assertions into each
  // other. Implementations set via mockResolvedValue are preserved.
  clearMocks: true,

  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/api/**/*.ts',
    'middleware.ts',
    '!**/__tests__/**',
    '!lib/types/**',
    '!**/*.d.ts',
  ],

  // json-summary feeds the coverage table in the CI job summary.
  coverageReporters: ['clover', 'json', 'json-summary', 'lcov', 'text'],

  // 90% is the floor enforced on every pull request (.github/workflows/ci.yml).
  // Treat these as a ratchet: raise them as coverage grows, never lower them.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 92,
    },
  },
})
