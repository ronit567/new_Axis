import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

type Props = {
  index?: number;
  style?: ViewStyle;
  children: React.ReactNode;
};

const STAGGER_MS = 60;
const MAX_DELAY_MS = 360;

// One-time staggered enter for freshly-mounted list/grid content —
// each item fades and slides up slightly after the one before it.
export default function FadeInItem({ index = 0, style, children }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * STAGGER_MS, MAX_DELAY_MS);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
