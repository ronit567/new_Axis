import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  active: boolean;
  activeName: IoniconsName;
  inactiveName: IoniconsName;
  activeColor: string;
  inactiveColor: string;
  size?: number;
};

// Cross-fades two stacked icons on toggle (scale 0.25 -> 1, opacity 0 -> 1)
// instead of snapping between them.
export default function AnimatedIconToggle({
  active,
  activeName,
  inactiveName,
  activeColor,
  inactiveColor,
  size = 18,
}: Props) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  const activeStyle = {
    opacity: progress,
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }],
  };
  const inactiveStyle = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }],
  };

  return (
    <>
      <Animated.View style={[styles.layer, inactiveStyle]}>
        <Ionicons name={inactiveName} size={size} color={inactiveColor} />
      </Animated.View>
      <Animated.View style={activeStyle}>
        <Ionicons name={activeName} size={size} color={activeColor} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
});
