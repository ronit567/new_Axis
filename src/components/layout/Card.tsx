import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../constants/theme';

type Props = {
  children: React.ReactNode;
  // Grouped rows (settings lists) clip their children to the corner radius so
  // a pressed row's highlight can't square off the card. Content cards that
  // need to overflow — a badge hanging past the edge — opt out.
  clip?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The single grouped-content container. Settings used radius 12, Manage
// Listings used radius 20, and both called themselves `card` — the kind of
// divergence that reads, correctly, as two different apps.
export default function Card({ children, clip = true, style }: Props) {
  return <View style={[styles.card, clip ? styles.clip : null, style]}>{children}</View>;
}

// The small uppercase label above a group. Pulled alongside Card because the
// two are always used together and their spacing has to agree.
export function SectionLabel({ title, style }: { title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <Text style={styles.sectionLabelText}>{title}</Text>
    </View>
  );
}

// A hairline between rows inside a Card, inset so it starts at the row's text
// rather than the card edge — the detail that makes a grouped list read as
// iOS-native rather than as a stack of divs.
export function CardDivider({ inset = 52 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    ...SHADOWS.card,
  },
  clip: {
    overflow: 'hidden',
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabelText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
  },
});
