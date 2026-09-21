/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Discover any *.test.ts / *.test.tsx anywhere under the project (e.g. src/**).
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Never scan node_modules or the git worktrees the agents run in — the latter
  // live inside the repo (.claude/worktrees) and cause duplicate-test + Haste
  // module-naming collisions if included.
  //
  // Anchored to <rootDir>, not bare '/.claude/'. An agent worktree IS a path
  // containing '/.claude/', so the unanchored form matched the worktree's own
  // test files and `npx jest` inside one reported "No tests found" — agents hit
  // this and had to override the flags by hand to run the suite at all. Under
  // <rootDir> the pattern still hides worktrees from a run in the main
  // checkout (rootDir is the repo, so <rootDir>/.claude/ is where they live),
  // while a run inside a worktree resolves rootDir to the worktree itself and
  // its tests no longer match.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
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
  // Jest's 5s default is a poor fit for the component suites. The first render
  // in a file pays the one-off cost of pulling in the RN/Expo native shims
  // (expo-blur, expo-image, @expo/vector-icons) through Babel; locally that
  // lands around 350ms, but a cold CI runner with no Babel cache has blown
  // past 5s and failed a test that is not actually slow. Raised rather than
  // scattering per-test timeouts, since any component suite can hit this.
  testTimeout: 20000,
};
