/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Discover any *.test.ts / *.test.tsx anywhere under the project (e.g. src/**).
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Never scan node_modules or the git worktrees the agents run in — the latter
  // live inside the repo (.claude/worktrees) and cause duplicate-test + Haste
  // module-naming collisions if included.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  modulePathIgnorePatterns: ['/.claude/'],
  // Keep node_modules untransformed EXCEPT the RN / Expo packages that ship
  // untranspiled ESM/Flow and therefore need Babel.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@testing-library/react-native))',
  ],
  // Mirror the "@/*" -> "src/*" alias from tsconfig.json so imports resolve in tests.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
