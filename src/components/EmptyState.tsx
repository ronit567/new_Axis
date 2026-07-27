import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { CURVE, DURATION, SPRING } from '../constants/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import PrimaryButton from './PrimaryButton';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IoniconsName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  ctaLabel: string;
  onCta: () => void;
};

// An empty state is usually a small disappointment — a search that found
// nothing, a list not started yet. Arriving in sequence (medallion, then
// message, then the way forward) makes it feel composed and intentional
// rather than like a failure the screen fell back to.
export default function EmptyState({
  icon,
  iconColor = COLORS.primary,
  iconBg = COLORS.primarySoft,
  title,
  ctaLabel,
  onCta,
}: Props) {
  const medallion = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      // Everything still arrives, but as a single flat fade with no scale and
      // no sequencing to track.
      Animated.timing(copy, {
        toValue: 1,
        duration: DURATION.fast,
        easing: CURVE.standard,
        useNativeDriver: true,
      }).start();
      medallion.setValue(1);
      return;
    }

    const animation = Animated.stagger(90, [
      // The medallion lands with a spring — it's the anchor of the layout, so
      // it earns the only bit of overshoot on screen.
      Animated.spring(medallion, { toValue: 1, ...SPRING.pop, useNativeDriver: true }),
      Animated.timing(copy, {
        toValue: 1,
        duration: DURATION.slow,
        easing: CURVE.enter,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [medallion, copy, reducedMotion]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconCircle,
          { backgroundColor: iconBg },
          {
            opacity: medallion.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
            transform: reducedMotion
              ? []
              : [{ scale: medallion.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      >
        <Ionicons name={icon} size={40} color={iconColor} />
      </Animated.View>
      <Animated.View
        style={[
          styles.copy,
          {
            opacity: copy,
            transform: reducedMotion
              ? []
              : [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        <PrimaryButton title={ctaLabel} onPress={onCta} style={styles.button} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...SHADOWS.card,
  },
  copy: {
    alignItems: 'center',
    // The wrapper is what animates now, so it has to carry the cross-axis
    // alignment the container used to apply to these children directly.
    alignSelf: 'stretch',
  },
  title: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    minWidth: 180,
    width: undefined,
  },
});
