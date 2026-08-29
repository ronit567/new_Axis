import { Easing } from 'react-native';

// The app's motion vocabulary. Every animation in the app pulls its timing,
// curve, and spring physics from here rather than inlining magic numbers —
// that consistency is what separates motion that feels *designed* from motion
// that merely moves. When two things animate at once (a chip recoloring while
// a thumb slides under it) they share a curve, so they read as one gesture.

// Durations, in ms. The scale is deliberately coarse: five steps is enough to
// express every transition in the app, and a small set keeps unrelated
// animations naturally in sync.
export const DURATION = {
  // Press feedback and other "already happened" acknowledgements. Anything
  // slower than this reads as lag rather than response.
  instant: 110,
  // Icon swaps, chip recolors, hairlines fading in.
  fast: 170,
  // The default for most state changes — sheet content, cross-fades, reveals.
  base: 240,
  // Entrances that travel some distance, or that the eye should follow.
  slow: 340,
  // Full-screen/hero moments. Used sparingly; frequent use feels sluggish.
  deliberate: 480,
} as const;

// Curves. Named for what they're *for*, not for their control points, so call
// sites read as intent. All are cubic beziers rather than the RN default
// (inOut ease), which is symmetric and therefore reads flat and mechanical —
// real objects decelerate far longer than they accelerate.
export const CURVE = {
  // Elements arriving on screen. A long, soft tail (expo-out) makes content
  // feel like it settles into place under its own weight.
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  // Elements leaving. Mirrors `enter` — quick to commit, so a dismissal never
  // makes the user wait on the thing they just dismissed.
  exit: Easing.bezier(0.7, 0, 0.84, 0),
  // The workhorse for changes that stay on screen (color, size, position).
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  // Motion that starts at rest and ends off-screen or at rest again, where
  // the start should be immediate.
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  // A touch of overshoot for affirmative moments — a save landing, a
  // confirmation. Never for anything that happens frequently or in bulk.
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
  // Continuous loops (shimmer sweeps, marquees) where any easing would make
  // the seam between iterations visible.
  linear: Easing.linear,
} as const;

// Spring presets, in RN's stiffness/damping/mass form — chosen over
// speed/bounciness because the physical parameters are readable and compose
// predictably. Springs are preferred over timing anywhere the user's finger
// is involved: they absorb interruption gracefully, timings restart abruptly.
export const SPRING = {
  // Finger-down feedback: reaches the pressed state almost immediately with
  // no wobble, so the surface feels rigid rather than rubbery.
  press: { stiffness: 900, damping: 60, mass: 1 },
  // Finger-up: a trace of overshoot so release feels elastic, not merely
  // "undone".
  release: { stiffness: 400, damping: 24, mass: 1 },
  // Indicators and thumbs travelling a measured distance (segmented control,
  // tab lens). Settles cleanly without ringing.
  snap: { stiffness: 320, damping: 26, mass: 1 },
  // Affirmative pops — a heart filling, a badge landing. Visible overshoot is
  // the point.
  pop: { stiffness: 420, damping: 13, mass: 1 },
  // Large surfaces (sheets, headers) where a stiff spring would look nervous.
  gentle: { stiffness: 180, damping: 22, mass: 1 },
} as const;

// List/grid entrance cadence. The cap matters more than the step: without it,
// the tail of a long list animates long after the user has started reading,
// which reads as jank rather than choreography.
export const STAGGER = {
  step: 55,
  max: 400,
} as const;

// Convenience for `Animated.timing` — spreads a duration + curve together so
// call sites can't accidentally pair a curve with a mismatched duration.
export const timing = (duration: number, easing: (value: number) => number = CURVE.standard) => ({
  duration,
  easing,
  useNativeDriver: true,
});
