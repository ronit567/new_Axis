import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import PrimaryButton from '../components/PrimaryButton';
import StepHeader from '../components/StepHeader';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 5;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { verifyOtp } = useAuth();
  const email = route?.params?.email ?? 'rsharma42@uwo.ca';
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(42);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (text: string, index: number) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    if (sanitized.length > 1) {
      const chars = sanitized.split('').slice(0, CODE_LENGTH - index);
      const newCode = [...code];
      chars.forEach((char: string, i: number) => {
        if (index + i < CODE_LENGTH) newCode[index + i] = char;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }
    const newCode = [...code];
    newCode[index] = sanitized;
    setCode(newCode);
    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // A successful verifyOtp establishes a session; RootNavigator then swaps to
  // the signed-in stack automatically, so there is no manual navigation here.
  const handleVerify = async () => {
    if (!isFilled || submitting) return;
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

  const handleResend = () => {
    setCountdown(60);
    setCode(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  const isFilled = code.every(c => c !== '');
  const formattedTime = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safe}>
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
            <Text style={styles.mailIcon}>✉️</Text>
          </View>

          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            We sent a 5-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <View style={styles.codeRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputRefs.current[index] = ref; }}
                style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
                value={digit}
                onChangeText={text => handleCodeChange(text, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectionColor={COLORS.primary}
              />
            ))}
          </View>

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
    </SafeAreaView>
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
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mailIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: SIZES.xxl,
    fontWeight: '700',
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
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  codeBox: {
    width: 52,
    height: 60,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  codeBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8F3FF',
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
