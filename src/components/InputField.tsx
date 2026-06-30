import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, ViewStyle, TextInputProps } from 'react-native';
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
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.rightBtn}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
        {rightElement && !isPassword && <View style={styles.rightBtn}>{rightElement}</View>}
      </View>
      {hint ? (
        <Text style={[styles.hint, hintType === 'success' ? styles.hintSuccess : null, hintType === 'error' ? styles.hintError : null]}>
          {hintType === 'success' ? '✓ ' : ''}{hint}
        </Text>
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
  },
  input: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  rightBtn: {
    paddingLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },
  hint: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  hintSuccess: {
    color: COLORS.success,
  },
  hintError: {
    color: COLORS.error,
  },
});
