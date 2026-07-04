import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, GRADIENTS, SHADOWS } from '../constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, loading = false, style, textStyle, disabled = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isInactive = disabled || loading;

  const animateTo = (value: number) => {
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !isInactive && animateTo(0.97)}
        onPressOut={() => !isInactive && animateTo(1)}
        disabled={isInactive}
        style={styles.pressable}
      >
        <LinearGradient
          colors={GRADIENTS.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, isInactive ? styles.disabled : null]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={[styles.text, textStyle]}>{title}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: SIZES.borderRadius,
    ...SHADOWS.brand,
  },
  pressable: {
    width: '100%',
  },
  button: {
    borderRadius: SIZES.borderRadius,
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
