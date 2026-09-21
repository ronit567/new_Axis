// Global Jest setup for the Axis test harness.
//
// @testing-library/react-native v13 auto-registers its Jest matchers
// (e.g. `toBeOnTheScreen`, `toHaveTextContent`) — no manual `extend-expect`
// import is required. This file is the canonical place for global test setup
// (mocks, polyfills, matchers).

// Fonts count as already loaded.
//
// Every @expo/vector-icons icon checks `Font.isLoaded()` in its constructor and,
// when that is false, awaits `Font.loadAsync()` in componentDidMount and calls
// setState once it resolves. In a test that resolution lands after the test has
// finished: it is what produced the "An update to Icon inside a test was not
// wrapped in act(...)" warnings (eleven per full run, locally and on CI alike),
// and on a cold CI runner the load is slow enough that @testing-library's
// afterEach cleanup waits on it past the 20s hook timeout. That is why the same
// four icon-rendering tests in layout.test.tsx kept failing on CI while the
// suite's icon-free tests passed, and why a plain re-run sometimes cleared it.
//
// Reporting fonts as loaded makes an icon render the way it does in the app
// once fonts are ready, with no asynchronous work to outlive the test. Only the
// two loading functions are overridden; the rest of expo-font stays real.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));

export {};
