import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import PressableScale from './PressableScale';
import Avatar from './Avatar';

// Height of the collapsed-away greeting row: 38px avatar + 14px paddingBottom.
// Home and Search both collapse exactly this so the purple header lands at the
// same height across the (animation: 'none') swap between them.
export const GREETING_ROW_HEIGHT = 52;

type Props = {
  avatarUrl?: string | null;
  initials?: string;
  firstName?: string;
  unreadCount?: number;
  onBellPress: () => void;
  // Browsing signed out: there is no profile to greet and no notifications to
  // ring for, so a person glyph stands in for the avatar and a Sign in button
  // takes the bell's place. Both are the same size as what they replace, so
  // the row keeps GREETING_ROW_HEIGHT.
  onSignInPress?: () => void;
};

// Shared between Home (static) and Search (collapses on entrance) so the two
// can't drift and the screen swap stays pixel-identical — which is also why the
// real avatar/name live here rather than being duplicated per screen.
export default function GreetingRow({
  avatarUrl,
  initials = '',
  firstName,
  unreadCount = 0,
  onBellPress,
  onSignInPress,
}: Props) {
  const isGuest = !!onSignInPress;
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {isGuest ? (
          <View style={[styles.avatarSmall, styles.guestAvatar]}>
            <Ionicons name="person-outline" size={18} color={COLORS.white} />
          </View>
        ) : (
          <Avatar
            url={avatarUrl}
            initials={initials}
            // Translucent chip look from the mock, not the profile's solid
            // avatarColor — this sits on the purple gradient header.
            color="rgba(255,255,255,0.2)"
            size={38}
            style={styles.avatarSmall}
            textStyle={styles.avatarText}
          />
        )}
        <View>
          <Text style={styles.greeting}>
            {isGuest ? 'Hi there' : firstName ? `Hi, ${firstName}` : 'Hi'}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.location}>Western · London, ON</Text>
          </View>
        </View>
      </View>
      {isGuest ? (
        <PressableScale
          style={styles.signInBtn}
          onPress={onSignInPress}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          scaleTo={0.94}
          accessibilityRole="button"
        >
          <Text style={styles.signInText}>Sign in</Text>
        </PressableScale>
      ) : (
        <PressableScale
          style={styles.bellBtn}
          onPress={onBellPress}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          scaleTo={0.9}
          accessibilityRole="button"
          // The unread dot is visual only, so say it in words.
          accessibilityLabel={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  guestAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  greeting: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same height as the bell it replaces, so the row's height doesn't change.
  signInBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
});
