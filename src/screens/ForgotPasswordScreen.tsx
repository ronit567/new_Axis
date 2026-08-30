import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Screen from '../components/layout/Screen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import PressableScale from '../components/PressableScale';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { isWesternEmail } from '../lib/email';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = email.trim();
  const canSubmit = !!trimmed && isWesternEmail(trimmed);

  const handleSend = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      // Advance regardless of whether that address has an account. Supabase
      // stays silent on unknown emails on purpose, and branching here would
      // leak which addresses are registered — the whole point of that silence.
      navigation.navigate('ResetPassword', { email: trimmed });
    } catch (e) {
      Alert.alert(
        "Couldn't send the code",
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
          <PressableScale
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            scaleTo={0.9}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </PressableScale>

          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter your Western email and we'll send you a 6-digit code to set a new
            password.
          </Text>

          <View style={styles.form}>
            <InputField
              label="Western email"
              value={email}
              onChangeText={setEmail}
              placeholder="yourname@uwo.ca"
              keyboardType="email-address"
              hint={
                email.length > 4 && !isWesternEmail(email)
                  ? 'Use your @uwo.ca or @alumni.uwo.ca email.'
                  : undefined
              }
              hintType={email.length > 4 && !isWesternEmail(email) ? 'error' : 'info'}
            />

            <PrimaryButton
              title="Send code"
              onPress={handleSend}
              disabled={!canSubmit}
              loading={submitting}
              style={styles.sendBtn}
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
    lineHeight: 22,
  },
  form: { flex: 1 },
  sendBtn: { marginTop: 8 },
});
