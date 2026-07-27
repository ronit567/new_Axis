import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPRING } from '../constants/motion';

type Props = {
  open: boolean;
  size?: number;
  color: string;
};

// Rotates a single chevron-down 180deg instead of swapping icon glyphs.
export default function RotatingChevron({ open, size = 16, color }: Props) {
  const rotation = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    // Sprung rather than timed: the chevron tracks a disclosure the user just
    // toggled, and the slight settle at the end makes the rotation feel
    // mechanical — like a switch landing — instead of merely interpolated.
    Animated.spring(rotation, {
      toValue: open ? 1 : 0,
      ...SPRING.snap,
      useNativeDriver: true,
    }).start();
  }, [open, rotation]);

  // Clamped so the spring's overshoot can't push the glyph past level, which
  // would read as a wobble rather than a settle.
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}
