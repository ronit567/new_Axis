import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { CURVE, DURATION, SPRING } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  active: boolean;
  activeName: IoniconsName;
  inactiveName: IoniconsName;
  activeColor: string;
  inactiveColor: string;
  size?: number;
  // Expanding ring on activation. On by default because every current caller
  // is an affirmative toggle (saving a listing); pass false for toggles where
  // "on" isn't something to celebrate.
  burst?: boolean;
};

// Cross-fades two stacked icons on toggle. Activation runs on a bouncy spring
// so the incoming icon overshoots and settles — the overshoot is what makes a
// save feel *committed* rather than merely recorded. Deactivation uses a
// clean, non-bouncing spring: undoing something shouldn't celebrate itself.
export default function AnimatedIconToggle({
  active,
  activeName,
  inactiveName,
  activeColor,
  inactiveColor,
  size = 18,
  burst = true,
}: Props) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  // Skips the burst on the very first render, so a grid of already-saved
  // listings doesn't fire a ring off every visible card on mount.
  const mounted = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      // A plain cross-fade with no overshoot and no ring: the state change is
      // still legible, but nothing scales or expands.
      Animated.timing(progress, {
        toValue: active ? 1 : 0,
        duration: DURATION.fast,
        easing: CURVE.standard,
        useNativeDriver: true,
      }).start();
      mounted.current = true;
      return;
    }

    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      ...(active ? SPRING.pop : SPRING.snap),
      useNativeDriver: true,
    }).start();

    if (active && burst && mounted.current) {
      ring.setValue(0);
      Animated.timing(ring, {
        toValue: 1,
        duration: DURATION.slow,
        easing: CURVE.decelerate,
        useNativeDriver: true,
      }).start();
    }
    mounted.current = true;
  }, [active, progress, ring, burst, reducedMotion]);

  // Opacity is clamped while scale is not: the spring overshoots past 1, and
  // letting scale ride that overshoot is the whole effect — but an opacity
  // above 1 would just clip, and below 0 would flicker.
  const activeStyle = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }],
  };
  const inactiveStyle = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.25],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return (
    <Animated.View style={{ width: size, height: size }}>
      {burst && !reducedMotion && (
        // Expands outward from the icon and fades as it goes, reading as the
        // save radiating outward. pointerEvents none so it never intercepts
        // the tap that spawned it.
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: activeColor,
              opacity: ring.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0.45, 0],
              }),
              transform: [
                { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] }) },
              ],
            },
          ]}
        />
      )}
      <Animated.View style={[styles.layer, inactiveStyle]}>
        <Ionicons name={inactiveName} size={size} color={inactiveColor} />
      </Animated.View>
      <Animated.View style={[styles.layer, activeStyle]}>
        <Ionicons name={activeName} size={size} color={activeColor} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
});
