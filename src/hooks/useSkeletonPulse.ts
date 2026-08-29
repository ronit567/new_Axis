import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { CURVE, timing } from '../constants/motion';
import { useReducedMotion } from './useReducedMotion';

const REST = 0.4;
const PEAK = 1;
const HALF_CYCLE_MS = 700;

// Drives the shared opacity pulse for a screen's skeleton placeholders.
//
// One value per screen rather than one per skeleton: every placeholder on
// screen breathes in lockstep, which reads as a single surface loading. Given
// each its own value and they drift out of phase within a second or two,
// which looks like noise.
//
// Returns the value to hand to each ListingCardSkeleton/SkeletonLoader.
export function useSkeletonPulse(isLoading: boolean): Animated.Value {
  const pulse = useRef(new Animated.Value(REST)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isLoading) {
      pulse.setValue(REST);
      return;
    }
    // A loading indicator that pulses indefinitely is exactly the kind of
    // motion Reduce Motion exists to stop. Hold it at a legible static
    // opacity instead — still clearly a placeholder, just not animating.
    if (reducedMotion) {
      pulse.setValue(0.7);
      return;
    }

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: PEAK, ...timing(HALF_CYCLE_MS, CURVE.standard) }),
        Animated.timing(pulse, { toValue: REST, ...timing(HALF_CYCLE_MS, CURVE.standard) }),
      ]),
    );
    anim.start();
    return () => {
      anim.stop();
      pulse.setValue(REST);
    };
  }, [isLoading, pulse, reducedMotion]);

  return pulse;
}
