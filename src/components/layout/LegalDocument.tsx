import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from './Screen';
import ScreenHeader from './ScreenHeader';
import { COLORS, SIZES, FONTS } from '../../constants/theme';

type Props = {
  title: string;
  /** Rendered as "Last updated: <date>". */
  lastUpdated: string;
  onBack: () => void;
  children: React.ReactNode;
};

/**
 * The frame shared by the Privacy Policy, Terms of Service and Community
 * Guidelines screens: header, scrolling body and the "Last updated" line.
 *
 * Those three screens were the same file three times over — identical
 * scaffolding and a byte-identical stylesheet — differing only in their text.
 * The text stays in each screen, written out as `<Text style={legalStyles.*}>`,
 * so reviewing a policy change means reading the policy, not a data structure,
 * and so the legal copy was not rewritten in order to share its layout.
 */
export default function LegalDocument({ title, lastUpdated, onBack, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Screen background="surface">
      <ScreenHeader title={title} onBack={onBack} bordered />

      <ScrollView
        contentContainerStyle={[legalStyles.container, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={legalStyles.lastUpdated}>{`Last updated: ${lastUpdated}`}</Text>
        {children}
      </ScrollView>
    </Screen>
  );
}

export const legalStyles = StyleSheet.create({
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
