import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy policy</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerBtn: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  intro: {
    fontSize: SIZES.md,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: SIZES.md,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
});
