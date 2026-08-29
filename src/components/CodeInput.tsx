import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

// Must match `otp_length` under [auth.email] in supabase/config.toml AND the
// cloud project's Authentication -> Sign In / Providers -> Email -> Email OTP
// Length. Supabase defaults vary by when a project was provisioned (6 or 8),
// and a mismatch is silent: the emailed code simply won't fit the boxes and
// the user can never submit.
export const CODE_LENGTH = 6;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Ref to the first box so a parent can refocus after a resend. */
  firstInputRef?: React.MutableRefObject<TextInput | null>;
};

/**
 * The 6-box one-time-code field, shared by VerifyEmail (signup) and
 * ResetPassword (recovery) so the two can't drift apart on length or paste
 * behaviour. Handles auto-advance, backspace-to-previous, and pasting a whole
 * code into any box.
 */
export default function CodeInput({ value, onChange, firstInputRef }: Props) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    const sanitized = text.replace(/[^0-9]/g, '');

    // Pasting (or an SMS/email autofill) drops the whole code into one box —
    // spread it across the remaining boxes rather than truncating to one digit.
    if (sanitized.length > 1) {
      const chars = sanitized.split('').slice(0, CODE_LENGTH - index);
      const next = [...value];
      chars.forEach((char, i) => {
        if (index + i < CODE_LENGTH) next[index + i] = char;
      });
      onChange(next);
      inputRefs.current[Math.min(index + chars.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    const next = [...value];
    next[index] = sanitized;
    onChange(next);
    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {value.map((digit, index) => (
        <TextInput
          key={index}
          ref={ref => {
            inputRefs.current[index] = ref;
            if (index === 0 && firstInputRef) firstInputRef.current = ref;
          }}
          style={[styles.box, digit ? styles.boxFilled : null]}
          value={digit}
          onChangeText={text => handleChange(text, index)}
          onKeyPress={e => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectionColor={COLORS.primary}
        />
      ))}
    </View>
  );
}

export const emptyCode = () => Array(CODE_LENGTH).fill('');
export const isCodeFilled = (code: string[]) => code.every(c => c !== '');

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  box: {
    width: 46,
    height: 60,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8F3FF',
  },
});
