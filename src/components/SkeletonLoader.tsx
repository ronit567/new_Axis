import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, ViewStyle, DimensionValue, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES } from '../constants/theme';
import { CURVE, timing } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  animatedValue?: Animated.Value;
};

export default function SkeletonLoader({
  width = '100%',
  height = 16,
  borderRadius = SIZES.borderRadiusSm,
  style,
  animatedValue,
}: Props) {
  const ownOpacity = useRef(new Animated.Value(0.4)).current;
  const opacity = animatedValue ?? ownOpacity;
  const shimmerX = useRef(new Animated.Value(0)).current;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (animatedValue) return;
    // Reduce Motion gets a static mid-opacity block: still legibly a
    // placeholder, but nothing breathes.
    if (reducedMotion) {
      ownOpacity.setValue(0.7);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        // Eased rather than linear so the pulse breathes instead of ticking
        // between two states.
        Animated.timing(ownOpacity, { toValue: 1, ...timing(700, CURVE.standard) }),
        Animated.timing(ownOpacity, { toValue: 0.4, ...timing(700, CURVE.standard) }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [ownOpacity, animatedValue, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1300,
        // Linear is deliberate here — any easing would make the seam between
        // loop iterations visible as a stutter.
        easing: CURVE.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerX, reducedMotion]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setMeasuredWidth(e.nativeEvent.layout.width);
  };

  const shimmerWidth = Math.max(measuredWidth * 0.6, 40);
  const translateX = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, measuredWidth + shimmerWidth],
  });

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.block,
        { width, height, borderRadius, opacity },
        styles.clip,
        style,
      ]}
    >
      {measuredWidth > 0 && !reducedMotion && (
        <Animated.View
          style={[
            styles.shimmer,
            { width: shimmerWidth, transform: [{ translateX }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: COLORS.inputBorder,
  },
  clip: {
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
  },
});
