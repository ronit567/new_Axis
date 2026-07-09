import React from 'react';
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
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
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
        <View>
          <Text style={styles.greeting}>{firstName ? `Hi, ${firstName}` : 'Hi'}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.location}>Western · London, ON</Text>
          </View>
        </View>
      </View>
      <PressableScale
        style={styles.bellBtn}
        onPress={onBellPress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        scaleTo={0.9}
      >
        <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
        {unreadCount > 0 && <View style={styles.bellDot} />}
      </PressableScale>
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
