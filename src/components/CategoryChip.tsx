import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, SHADOWS } from '../constants/theme';
import { CURVE, DURATION, SPRING } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import PressableScale from './PressableScale';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

// A filter chip whose selection *blooms* rather than snaps. The brand fill
// scales up from beneath the label while the label's two color variants
// cross-fade, so switching categories reads as one continuous change.
//
// Everything here runs on the native driver, which rules out animating
// backgroundColor or color directly (both are JS-thread properties). Instead
// the fill is a real layer that scales and fades, and the label is rendered
// twice — dark and light, stacked — with opacity swapping between them. The
// in-flow copy sets the chip's size; the overlay copy is absolutely
// positioned and inherits identical metrics, so the two register exactly.
export default function CategoryChip({ label, active, onPress }: Props) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      Animated.timing(progress, {
        toValue: active ? 1 : 0,
        duration: DURATION.fast,
        easing: CURVE.standard,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      ...SPRING.snap,
      useNativeDriver: true,
    }).start();
  }, [active, progress, reducedMotion]);

  // Clamped: the snap spring overshoots slightly, and an opacity past 1 or a
  // fill scaling beyond the chip's own bounds would both read as a glitch.
  const clamped = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <PressableScale
      style={styles.chip}
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.fill,
          {
            opacity: clamped,
            transform: reducedMotion
              ? []
              : [{ scale: clamped.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
          },
        ]}
      >
        <LinearGradient
          colors={GRADIENTS.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View>
        <Animated.Text
          style={[
            styles.label,
            { opacity: clamped.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
        >
          {label}
        </Animated.Text>
        <Animated.Text
          style={[styles.label, styles.labelActive, StyleSheet.absoluteFillObject, { opacity: clamped }]}
        >
          {label}
        </Animated.Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    // Clips the blooming fill to the pill; without it the scaling gradient
    // renders as a rectangle bleeding past the rounded ends.
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
    overflow: 'hidden',
    ...SHADOWS.brand,
  },
  label: {
    fontSize: 13,
    color: COLORS.text,
    // Both stacked copies must share every metric-affecting property, or the
    // absolutely-positioned overlay would measure differently from the
    // in-flow copy that sizes the chip and the two would visibly misregister
    // mid-fade. Selection is expressed by the fill and color, not by weight.
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: {
    color: COLORS.white,
  },
});
