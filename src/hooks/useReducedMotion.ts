import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Tracks the OS "Reduce Motion" setting, live. Returns false until the async
// initial read resolves, so animations behave normally on first frame rather
// than flashing a reduced variant and then correcting.
//
// The subscription matters: users toggle Reduce Motion mid-session (it's in
// iOS Control Center for many people), and a one-shot read would leave the
// app animating against an explicit accessibility preference until relaunch.
//
// Consumers should degrade rather than disable — opacity cross-fades are
// generally safe under Reduce Motion, while large translations, scale, and
// looping/parallax effects are what the setting exists to suppress.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (active) setReduced(value);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
