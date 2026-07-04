import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = PressableProps & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// 0.96 is the floor before press feedback starts reading as exaggerated.
export default function PressableScale({ scaleTo = 0.96, style, children, disabled, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={(e) => {
        if (!disabled) animateTo(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) animateTo(1);
        rest.onPressOut?.(e);
      }}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
