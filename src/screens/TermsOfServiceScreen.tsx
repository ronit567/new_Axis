import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

export default function TermsOfServiceScreen({ navigation }: Props) {
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
        <Text style={styles.headerTitle}>Terms of service</Text>
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
          Welcome to Axis. By creating an account or using the app you agree to
          these terms. They keep the marketplace fair and safe for every student.
        </Text>

        <Text style={styles.sectionTitle}>Eligibility</Text>
        <Text style={styles.paragraph}>
          Axis is only for current university students. You must sign up with a
          valid school-issued .edu email address and complete verification. You are
          responsible for keeping your login credentials secure and for all activity
          on your account.
        </Text>

        <Text style={styles.sectionTitle}>Acceptable use</Text>
        <Text style={styles.paragraph}>
          Use Axis honestly and respectfully. Do not post misleading listings,
          impersonate others, spam, or attempt to access accounts that are not
          yours. You may not use the app for any unlawful purpose or in a way that
          disrupts the service for other students.
        </Text>

        <Text style={styles.sectionTitle}>Listings and transactions</Text>
        <Text style={styles.paragraph}>
          You are responsible for the items you list, including their accuracy,
          pricing, condition, and legality. Transactions happen directly between
          buyers and sellers. Axis is a platform to connect students; we are not a
          party to any sale and do not process payments or guarantee any item.
          Always confirm details and meet safely before exchanging money.
        </Text>

        <Text style={styles.sectionTitle}>Disclaimer of liability</Text>
        <Text style={styles.paragraph}>
          Axis is provided "as is" without warranties of any kind. We are not
          responsible for the quality, safety, or legality of listed items, the
          conduct of users, or the outcome of any transaction. To the fullest
          extent permitted by law, Axis is not liable for any loss arising from
          your use of the app.
        </Text>

        <Text style={styles.sectionTitle}>Termination</Text>
        <Text style={styles.paragraph}>
          You may stop using Axis and delete your account at any time. We may
          suspend or terminate accounts that violate these terms or our Community
          Guidelines, or that put other students at risk.
        </Text>

        <Text style={styles.sectionTitle}>Contact us</Text>
        <Text style={styles.paragraph}>
          Questions about these terms? Email us at support@axis.app.
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
