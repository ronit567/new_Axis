import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityGuidelines'>;

export default function CommunityGuidelinesScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community guidelines</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
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
