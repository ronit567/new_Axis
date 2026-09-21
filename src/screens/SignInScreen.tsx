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
import Screen from '../components/layout/Screen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../lib/haptics';
import HeaderIconButton from '../components/layout/HeaderIconButton';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (submitting) return;
    haptics.impact();
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      Alert.alert(
        'Sign in failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          <HeaderIconButton
            icon="chevron-back"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            color={COLORS.text}
            size={22}
            style={styles.backBtn}
          />

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Axis account.</Text>

          <View style={styles.form}>
            <InputField
              label="Western email"
              value={email}
              onChangeText={setEmail}
              placeholder="yourname@uwo.ca"
              keyboardType="email-address"
            />
            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <PrimaryButton
              title="Sign in"
              onPress={handleSignIn}
              loading={submitting}
              style={styles.signInBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Axis? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateAccount')}
              accessibilityRole="button"
            >
              <Text style={styles.footerLink}>Create account</Text>
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
  },
  // Size, shape and tint come from HeaderIconButton, the same control every
  // other header uses; this only positions it.
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  title: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 24,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: SIZES.sm,
    fontWeight: '500',
  },
  signInBtn: {
    marginBottom: 24,
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
