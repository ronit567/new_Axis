import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, ViewStyle, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

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

  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, focused ? styles.inputWrapperFocused : null]}>
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
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.rightBtn} hitSlop={8}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
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
    backgroundColor: COLORS.inputBackground,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
  },
  inputWrapperFocused: {
    borderColor: COLORS.inputBorderFocused,
    backgroundColor: COLORS.primaryTint,
  },
  input: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
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
