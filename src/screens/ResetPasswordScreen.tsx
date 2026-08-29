import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import Screen from '../components/layout/Screen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import PressableScale from '../components/PressableScale';
import CodeInput, { emptyCode, isCodeFilled } from '../components/CodeInput';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { verifyPasswordResetOtp, updatePassword, requestPasswordReset } = useAuth();
  // Required route param — no placeholder fallback. This screen verifies and
  // resends against `email`, so a stand-in would mail a code to an address the
  // user never typed and then fail verification with a confusing error.
  const email = route.params.email;

  const [code, setCode] = useState<string[]>(emptyCode());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const firstBoxRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    isCodeFilled(code) && !!password.trim() && !!confirmPassword.trim() && passwordsMatch;

  const handleReset = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      // Redeeming the code SIGNS THE USER IN — RootNavigator swaps to the
      // signed-in stack the moment the session lands, which unmounts this
      // screen. That's fine: this async function keeps running to completion
      // regardless, so the password update still applies. Both calls must stay
      // in this one handler for that reason — splitting them across screens
      // would strand the user signed in with their OLD password.
      await verifyPasswordResetOtp(email, code.join(''));
      await updatePassword(password);
    } catch (e) {
      // Alert is imperative native UI, so it still shows if the swap above
      // already unmounted this screen.
      Alert.alert(
        "Couldn't reset your password",
        e instanceof Error ? e.message : 'Check the code and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    try {
      await requestPasswordReset(email);
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setCode(emptyCode());
      firstBoxRef.current?.focus();
    } catch (e) {
      Alert.alert(
        'Resend failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setResending(false);
    }
  };

  const formattedTime = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  return (
    <Screen background="surface">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PressableScale
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            scaleTo={0.9}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </PressableScale>

          <View style={styles.iconWrapper}>
            <Ionicons name="lock-open-outline" size={30} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            If an Axis account exists for{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
            {'\n'}we sent it a 6-digit code.
          </Text>

          <CodeInput value={code} onChange={setCode} firstInputRef={firstBoxRef} />

          <TouchableOpacity
            style={styles.resendRow}
            onPress={countdown === 0 ? handleResend : undefined}
            activeOpacity={countdown === 0 ? 0.7 : 1}
          >
            <Text style={styles.resendText}>
              Resend code in{' '}
              <Text style={[styles.timerText, countdown === 0 ? styles.resendActive : null]}>
                {countdown === 0 ? 'Resend now' : formattedTime}
              </Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.form}>
            <InputField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a new password"
              secureTextEntry
            />
            <InputField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your new password"
              secureTextEntry
              hint={
                confirmPassword.length > 0
                  ? passwordsMatch
                    ? 'Passwords match.'
                    : 'Passwords do not match.'
                  : undefined
              }
              hintType={
                confirmPassword.length > 0 ? (passwordsMatch ? 'success' : 'error') : 'info'
              }
            />

            <PrimaryButton
              title="Reset password"
              onPress={handleReset}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emailHighlight: { color: COLORS.text, fontWeight: '600' },
  resendRow: { marginBottom: 28, alignSelf: 'center' },
  resendText: { fontSize: SIZES.sm, color: COLORS.textSecondary },
  timerText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  resendActive: { textDecorationLine: 'underline' },
  form: { flex: 1 },
  submitBtn: { marginTop: 8 },
});
