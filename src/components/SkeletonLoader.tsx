import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, ViewStyle, DimensionValue, LayoutChangeEvent, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const shimmerX = useRef(new Animated.Value(0)).current;
  const [measuredWidth, setMeasuredWidth] = useState(0);

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

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerX]);

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
      {measuredWidth > 0 && (
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
