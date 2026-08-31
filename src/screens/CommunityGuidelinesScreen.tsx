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

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityGuidelines'>;

export default function CommunityGuidelinesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Screen background="surface">
      <ScreenHeader title="Community guidelines" onBack={() => navigation.goBack()} bordered />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Axis works because students look out for each other. These guidelines keep
          the marketplace welcoming, honest, and safe. Break them and you may lose
          access to Axis.
        </Text>

        <Text style={styles.sectionTitle}>Be respectful</Text>
        <Text style={styles.paragraph}>
          Treat every student the way you would want to be treated. Keep messages
          polite, communicate clearly, and honor the deals you agree to. A little
          courtesy goes a long way on a campus you share.
        </Text>

        <Text style={styles.sectionTitle}>No prohibited or illegal items</Text>
        <Text style={styles.paragraph}>
          Do not list anything illegal or unsafe, including alcohol, drugs, weapons,
          stolen goods, counterfeit items, or anything that violates your school's
          policies. If it wouldn't be allowed on campus, it doesn't belong on Axis.
        </Text>

        <Text style={styles.sectionTitle}>No harassment or scams</Text>
        <Text style={styles.paragraph}>
          Harassment, hate speech, threats, and discrimination are never tolerated.
          Do not attempt to scam other students, post fake listings, ask for payment
          outside an agreed exchange, or pressure anyone into a deal.
        </Text>

        <Text style={styles.sectionTitle}>Meet safely on campus</Text>
        <Text style={styles.paragraph}>
          Arrange to meet in busy, public spots on campus during daylight, such as
          the student center or library. Inspect items before you pay, and never
          share more personal information than a transaction requires.
        </Text>

        <Text style={styles.sectionTitle}>Reporting</Text>
        <Text style={styles.paragraph}>
          If you see a listing or message that breaks these guidelines, report it so
          our team can review it. You can also block users you no longer want to hear
          from. Reports are confidential and help keep Axis safe for everyone.
        </Text>
        <Text style={styles.paragraph}>
          Our team reviews every report and responds within 24 hours. For anything
          urgent, or if you'd rather reach us directly, email{' '}
          <Text
            style={styles.emailLink}
            onPress={() => Linking.openURL('mailto:axis.app@outlook.com')}
            accessibilityRole="link"
          >
            axis.app@outlook.com
          </Text>
          .
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
