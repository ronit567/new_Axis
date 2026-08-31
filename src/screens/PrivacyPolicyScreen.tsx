import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Screen background="surface">
      <ScreenHeader title="Privacy policy" onBack={() => navigation.goBack()} bordered />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: August 30, 2026</Text>

        <Text style={styles.intro}>
          Axis is a marketplace built for verified university students. This policy
          explains what information we collect, how we use it, and the choices you
          have. We keep it short because you deserve to actually read it.
        </Text>

        <Text style={styles.sectionTitle}>Information we collect</Text>
        <Text style={styles.paragraph}>
          When you create an account we collect your name and your Western-issued
          @uwo.ca (or @alumni.uwo.ca) email address, which we use to confirm you
          are part of the Western community.
          As you use Axis we also store the listings you post (titles, prices,
          photos, and descriptions), the messages you send to other students, and
          basic activity such as items you save or view.
        </Text>

        <Text style={styles.sectionTitle}>How we use your information</Text>
        <Text style={styles.paragraph}>
          We use your information to verify your student status, show your listings
          to other buyers, deliver messages, keep the marketplace safe, and improve
          the app. We may send you service notifications about your account, your
          listings, or your conversations.
        </Text>

        <Text style={styles.sectionTitle}>How we share information</Text>
        <Text style={styles.paragraph}>
          Your name and active listings are visible to other verified students so
          they can buy from you. We do not sell your personal information, and we do
          not use it for advertising or tracking.
        </Text>
        <Text style={styles.paragraph}>
          Two service providers process data on our behalf, and both are contractually
          required to protect it: Supabase hosts our database, file storage, and
          sign-in, and Sentry receives crash reports when the app fails. Crash reports
          contain the technical details of the failure and your device model — never
          your name, email, messages, or listings. We share data otherwise only when
          required by law or to protect the safety of our community.
        </Text>

        <Text style={styles.sectionTitle}>Data retention</Text>
        <Text style={styles.paragraph}>
          We keep your account information while your account is active. When you
          delete your account we remove your profile and listings, though we may
          retain limited records where needed to resolve disputes, prevent abuse,
          or comply with legal obligations.
        </Text>

        <Text style={styles.sectionTitle}>Your choices</Text>
        <Text style={styles.paragraph}>
          You can edit or delete your listings at any time, update your profile
          details, and block anyone you no longer want to hear from. You can delete
          your account from the Settings screen, which permanently removes your
          profile, listings, photos, and messages.
        </Text>

        <Text style={styles.sectionTitle}>Contact us</Text>
        <Text style={styles.paragraph}>
          Questions about your privacy? Reach our team at{' '}
          <Text
            style={styles.emailLink}
            onPress={() => Linking.openURL('mailto:axis.app@outlook.com')}
            accessibilityRole="link"
          >
            axis.app@outlook.com
          </Text>{' '}
          and we will get back to you.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  lastUpdated: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  intro: {
    fontSize: SIZES.base,
    lineHeight: 25,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 28,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: SIZES.base,
    lineHeight: 25,
    color: COLORS.textSecondary,
  },
  emailLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
