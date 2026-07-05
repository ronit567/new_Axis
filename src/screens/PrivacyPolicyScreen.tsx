import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Privacy policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: July 1, 2026</Text>

        <Text style={styles.intro}>
          Axis is a marketplace built for verified university students. This policy
          explains what information we collect, how we use it, and the choices you
          have. We keep it short because you deserve to actually read it.
        </Text>

        <Text style={styles.sectionTitle}>Information we collect</Text>
        <Text style={styles.paragraph}>
          When you create an account we collect your name and your school-issued
          .edu email address, which we use to confirm you are a current student.
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
          they can buy from you. We do not sell your personal information. We only
          share data with service providers that help us run Axis, or when required
          by law to protect the safety of our community.
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
          details, and request deletion of your account. You may also control push
          notifications from the Settings screen.
        </Text>

        <Text style={styles.sectionTitle}>Contact us</Text>
        <Text style={styles.paragraph}>
          Questions about your privacy? Reach our team at privacy@axis.app and we
          will get back to you.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 38,
  },
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
});
