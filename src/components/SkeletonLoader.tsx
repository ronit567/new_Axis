import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

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

  useEffect(() => {
    if (animatedValue) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ownOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(ownOpacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [ownOpacity, animatedValue]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: COLORS.inputBorder,
  },
});
