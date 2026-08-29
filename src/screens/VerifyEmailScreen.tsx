import React, { useState, useRef, useEffect } from 'react';
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
import PrimaryButton from '../components/PrimaryButton';
import StepHeader from '../components/StepHeader';
import CodeInput, { emptyCode, isCodeFilled } from '../components/CodeInput';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { verifyOtp, resend } = useAuth();
  // No fallback address here on purpose. This screen both verifies and
  // resends against `email`, so a placeholder would send a real person's code
  // to a stranger's inbox and fail verification with a confusing error. The
  // route param is required, and CreateAccountScreen always passes it.
  const email = route.params.email;
  const [code, setCode] = useState<string[]>(emptyCode());
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

  // A successful verifyOtp establishes a session; RootNavigator then swaps to
  // the signed-in stack automatically, so there is no manual navigation here.
  const handleVerify = async () => {
    if (!isFilled || submitting) return;
    haptics.impact();
    setSubmitting(true);
    try {
      await verifyOtp(email, code.join(''));
    } catch (e) {
      Alert.alert(
        'Verification failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resend(email);
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

  const isFilled = isCodeFilled(code);
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
          <StepHeader currentStep={2} totalSteps={3} onBack={() => navigation.goBack()} />

          <Text style={styles.stepLabel}>Step 2 of 3</Text>

          <View style={styles.iconWrapper}>
            <Ionicons name="mail-outline" size={32} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
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

          <PrimaryButton
            title="Verify & continue"
            onPress={handleVerify}
            disabled={!isFilled}
            loading={submitting}
            style={styles.verifyBtn}
          />

          <View style={styles.wrongEmailRow}>
            <Text style={styles.wrongEmailText}>Wrong email? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.changeLink}>Change it</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 24,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    marginBottom: 32,
  },
  emailHighlight: {
    color: COLORS.text,
    fontWeight: '600',
  },
  resendRow: {
    marginBottom: 32,
  },
  resendText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  timerText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  resendActive: {
    textDecorationLine: 'underline',
  },
  verifyBtn: {
    width: '100%',
    marginBottom: 20,
  },
  wrongEmailRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  wrongEmailText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  changeLink: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
