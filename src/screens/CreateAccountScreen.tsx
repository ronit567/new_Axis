import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import StepHeader from '../components/StepHeader';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAccount'>;

export default function CreateAccountScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isWesternEmail = email.endsWith('@uwo.ca') || email.endsWith('@alumni.uwo.ca');
  const canContinue = fullName.trim() && email.trim() && password.trim() && agreed;

  const handleContinue = async () => {
    if (!canContinue || submitting) return;
    const trimmedEmail = email.trim();
    setSubmitting(true);
    try {
      await signUp(trimmedEmail, password);
      navigation.navigate('VerifyEmail', { email: trimmedEmail });
    } catch (e) {
      Alert.alert(
        'Sign up failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          <StepHeader currentStep={1} totalSteps={3} onBack={() => navigation.goBack()} />

          <Text style={styles.stepLabel}>Step 1 of 3</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Use your Western email so we can verify you.</Text>

          <View style={styles.form}>
            <InputField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ronit Sharma"
              autoCapitalize="words"
            />
            <InputField
              label="Western email"
              value={email}
              onChangeText={setEmail}
              placeholder="rsharma42@uwo.ca"
              keyboardType="email-address"
              hint={
                email.length > 4
                  ? isWesternEmail
                    ? 'Only @uwo.ca emails can join Axis.'
                    : 'Please use a @uwo.ca email address.'
                  : undefined
              }
              hintType={email.length > 4 ? (isWesternEmail ? 'success' : 'error') : 'info'}
            />
            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreed ? styles.checkboxChecked : null]}>
                {agreed && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the{' '}
                <Text style={styles.link}>Terms</Text>
                {' '}and{' '}
                <Text style={styles.link}>Community Guidelines</Text>
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              title="Continue"
              onPress={handleContinue}
              disabled={!canContinue}
              loading={submitting}
              style={styles.continueBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Axis? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>Create account</Text>
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
  },
  stepLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 6,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: 28,
  },
  form: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 24,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkMark: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  continueBtn: {
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
  },
  footerLink: {
    color: COLORS.primary,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
});
