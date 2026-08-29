import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { CURVE, DURATION, STAGGER } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  index?: number;
  style?: ViewStyle;
  children: React.ReactNode;
};

// One-time staggered enter for freshly-mounted list/grid content — each item
// rises and settles just after the one before it, so a loaded grid resolves as
// a wave rather than appearing all at once.
export default function FadeInItem({ index = 0, style, children }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const delay = Math.min(index * STAGGER.step, STAGGER.max);
    const animation = Animated.timing(progress, {
      toValue: 1,
      // The expo-out tail lets each card decelerate over most of its travel,
      // which is what makes the entrance read as weight rather than as a
      // slide. Reduce Motion keeps the fade but drops the travel below.
      duration: reducedMotion ? DURATION.fast : DURATION.slow,
      delay: reducedMotion ? 0 : delay,
      easing: CURVE.enter,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: reducedMotion
            ? []
            : [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                // A hair of scale alongside the rise reads as the card
                // approaching the viewer rather than sliding on a plane —
                // subtle enough to feel like depth, not a zoom.
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
