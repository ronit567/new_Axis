import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { SPRING } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = PressableProps & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  // Optional externally-owned press value (1 = at rest, `scaleTo` = fully
  // pressed). Supplied when a caller wants to choreograph something else
  // against the same press — e.g. ListingCard counter-scaling its image so
  // the artwork lifts as the card sinks. Left undefined, the component owns
  // its own value and nothing changes for existing callers.
  scaleValue?: Animated.Value;
};

// 0.96 is the floor before press feedback starts reading as exaggerated.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Springs rather than timings, for two reasons that matter under the finger:
// press-in reaches its target in ~80ms (a 150ms timing lags visibly behind a
// quick tap), and an interrupted spring continues from its current velocity
// instead of restarting, so a fast double-tap stays smooth rather than
// stuttering back to the start.
export default function PressableScale({
  scaleTo = 0.96,
  style,
  children,
  disabled,
  scaleValue,
  ...rest
}: Props) {
  const ownScale = useRef(new Animated.Value(1)).current;
  const scale = scaleValue ?? ownScale;
  const reducedMotion = useReducedMotion();

  const animateTo = (toValue: number, config: { stiffness: number; damping: number; mass: number }) => {
    Animated.spring(scale, { toValue, ...config, useNativeDriver: true }).start();
  };

  // Under Reduce Motion the transform is dropped entirely and press feedback
  // becomes a dim instead — the acknowledgement survives, the movement (which
  // is the part the setting exists to suppress) doesn't.
  const pressedStyle = reducedMotion
    ? { opacity: scale.interpolate({ inputRange: [scaleTo, 1], outputRange: [0.6, 1] }) }
    : { transform: [{ scale }] };

  return (
    <AnimatedPressable
      style={[style, pressedStyle]}
      onPressIn={(e) => {
        // Stiff and critically damped: the surface should feel rigid under
        // the finger, with no wobble on the way down.
        if (!disabled) animateTo(scaleTo, SPRING.press);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // Release carries a trace of overshoot so letting go feels elastic
        // rather than merely undone.
        if (!disabled) animateTo(1, SPRING.release);
        rest.onPressOut?.(e);
      }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
