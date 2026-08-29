import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle, TextInputProps, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import { CURVE, DURATION } from '../constants/motion';
import PressableScale from './PressableScale';
import AnimatedIconToggle from './AnimatedIconToggle';

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  hint?: string;
  hintType?: 'info' | 'success' | 'error';
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  inputRef?: React.RefObject<TextInput>;
};

export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  hint,
  hintType = 'info',
  rightElement,
  style,
  inputRef,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const focusProgress = useRef(new Animated.Value(0)).current;

  // Border and background colors can't be driven natively, so focus is a real
  // layer that cross-fades over the resting field rather than a style swap.
  // Fading it keeps the field from flashing as focus moves between inputs —
  // with a hard swap, tabbing through a form strobes.
  useEffect(() => {
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: DURATION.fast,
      easing: CURVE.standard,
      useNativeDriver: true,
    }).start();
  }, [focused, focusProgress]);

  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
        {/* Inset by the wrapper's own border width so this ring lands exactly
            on top of it — at absoluteFill it would sit inside and read as a
            second, doubled border. Behind the TextInput in paint order, so
            the tint never washes over the text. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.focusRing, { opacity: focusProgress }]}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPassword && (
          <PressableScale onPress={() => setShowPassword(!showPassword)} style={styles.rightBtn} hitSlop={8} scaleTo={0.85}>
            <AnimatedIconToggle
              active={showPassword}
              activeName="eye-off-outline"
              inactiveName="eye-outline"
              activeColor={COLORS.textMuted}
              inactiveColor={COLORS.textMuted}
              size={18}
            />
          </PressableScale>
        )}
        {rightElement && !isPassword && <View style={styles.rightBtn}>{rightElement}</View>}
      </View>
      {hint ? (
        <View style={styles.hintRow}>
          {hintType === 'success' ? (
            <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
          ) : null}
          <Text style={[styles.hint, hintType === 'success' ? styles.hintSuccess : null, hintType === 'error' ? styles.hintError : null]}>
            {hint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    borderCurve: 'continuous',
    backgroundColor: COLORS.inputBackground,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
  },
  focusRing: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorderFocused,
    borderRadius: SIZES.borderRadiusSm,
    borderCurve: 'continuous',
    backgroundColor: COLORS.primaryTint,
  },
  input: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
    // The animated focus ring paints a background, so the input itself must
    // stay transparent or it would mask the tint behind an opaque block.
    backgroundColor: 'transparent',
  },
  rightBtn: {
    paddingLeft: 8,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  hint: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  hintSuccess: {
    color: COLORS.success,
  },
  hintError: {
    color: COLORS.error,
  },
});
