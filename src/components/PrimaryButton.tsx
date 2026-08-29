import React from 'react';
import { Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, GRADIENTS, SHADOWS } from '../constants/theme';
import PressableScale from './PressableScale';
import { haptics } from '../lib/haptics';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, loading = false, style, textStyle, disabled = false }: Props) {
  const isInactive = disabled || loading;

  const handlePress = () => {
    if (isInactive) return;
    haptics.impact();
    onPress();
  };

  return (
    <PressableScale style={[styles.wrapper, style]} onPress={handlePress} disabled={isInactive}>
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    ...SHADOWS.brand,
  },
  button: {
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
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
