import { ComponentProps } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { haptics } from '../lib/haptics';
import Screen from './layout/Screen';
import ScreenHeader from './layout/ScreenHeader';
import Card, { CardDivider, SectionLabel } from './layout/Card';
import PrimaryButton from './PrimaryButton';
import PressableScale from './PressableScale';
import { FLOATING_TAB_BAR_CLEARANCE } from './BottomTabBar';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type LegalLinks = {
  onPrivacyPolicy: () => void;
  onTermsOfService: () => void;
  onCommunityGuidelines: () => void;
};

type Props = {
  // The tab's own large title, so a guest's Saved/Messages/Profile keep the
  // header a signed-in user sees there.
  title: string;
  icon: IoniconsName;
  heading: string;
  body: string;
  onSignIn: () => void;
  onCreateAccount: () => void;
  // Profile is where a signed-in user finds the legal documents (via
  // Settings), so a guest's Profile tab lists them directly instead.
  legal?: LegalLinks;
};

/**
 * What a guest sees on a tab that only makes sense with an account (Guideline
 * 5.1.1(v) lets those stay behind sign-in). It says what the tab is for and
 * offers the two ways in, in the tab's own frame rather than as a dead end.
 */
export default function SignInRequired({
  title,
  icon,
  heading,
  body,
  onSignIn,
  onCreateAccount,
  legal,
}: Props) {
  return (
    <Screen>
      <ScreenHeader variant="large" title={title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.heading} accessibilityRole="header">
            {heading}
          </Text>
          <Text style={styles.body}>{body}</Text>
          <PrimaryButton title="Sign in" onPress={onSignIn} style={styles.primary} />
          <PressableScale
            style={styles.secondary}
            onPress={() => {
              haptics.tap();
              onCreateAccount();
            }}
            scaleTo={0.96}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Create account</Text>
          </PressableScale>
        </View>

        {legal ? (
          <>
            <SectionLabel title="LEGAL" />
            <Card style={styles.card}>
              <LinkRow icon="document-text-outline" label="Privacy policy" onPress={legal.onPrivacyPolicy} />
              <CardDivider inset={42} />
              <LinkRow icon="reader-outline" label="Terms of service" onPress={legal.onTermsOfService} />
              <CardDivider inset={42} />
              <LinkRow
                icon="people-outline"
                label="Community guidelines"
                onPress={legal.onCommunityGuidelines}
              />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// Same row as Settings' legal group, so the documents look the same signed in
// or out.
function LinkRow({ icon, label, onPress }: { icon: IoniconsName; label: string; onPress: () => void }) {
  return (
    <PressableScale
      style={styles.row}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      scaleTo={0.98}
      accessibilityRole="button"
    >
      <View style={styles.rowIconBox}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...SHADOWS.card,
  },
  heading: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  primary: {
    maxWidth: 320,
  },
  secondary: {
    minHeight: 48,
    paddingHorizontal: 20,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  card: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  rowIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
  },
});
