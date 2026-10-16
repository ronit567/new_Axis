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
// wrapped in act(...)" warnings (eleven per full run, locally and on CI alike).
// (This was once blamed for layout.test.tsx timing out on CI; it wasn't. See
// the Animated block below for what was.)
//
// Reporting fonts as loaded makes an icon render the way it does in the app
// once fonts are ready, with no asynchronous work to outlive the test. Only the
// two loading functions are overridden; the rest of expo-font stays real.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));

// Animated.loop() never runs.
//
// This is what was hanging CI. React Native's Jest setup implements
// requestAnimationFrame as setTimeout(cb, 0), so every running Animated
// animation is a chain of 1ms timers. Skeletons and the Welcome screen start
// Animated.loop()s that only stop on unmount. On a slow runner a frame takes
// longer than 1ms, so by the time it finishes the next one is already due and
// Node never leaves its timers phase: setImmediate callbacks stop running
// entirely while setTimeout ones (including Jest's own timeouts) still fire.
// @testing-library's afterEach cleanup starts with `await setImmediate`
// before it unmounts anything, so it waits on the loop that only unmounting
// would stop, and fails at the hook timeout. The loop then carries on into
// whichever suite that worker runs next, which is why the failing suite moved
// around (layout.test.tsx for weeks, then avatarUrls.test.ts) and never
// reproduced on a fast machine, where frames finish inside the millisecond.
//
// Only loop() is replaced, with the one from AnimatedMock (React Native's own
// animations-disabled mode). It is inert: start() schedules nothing and, like
// a real infinite loop, never calls back. Finite animations stay real, since
// they end on their own and tests rely on their timing (the inbox's delete
// waits for the row to finish animating out).
import { Animated } from 'react-native';

Animated.loop = jest.requireActual<{ default: typeof Animated }>(
  'react-native/Libraries/Animated/AnimatedMock',
).default.loop;
