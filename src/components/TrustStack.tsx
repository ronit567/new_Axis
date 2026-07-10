import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import type { SellerBadge } from '../lib/sellerBadges';

type Props = {
  reviewCount: number;
  averageRating: number;
  // Jumps to the Reviews tab — the rating segment is the one tappable part.
  onPressRating: () => void;
  // Each is omitted from the " · " row when absent (0 / null / empty) rather
  // than shown as a hollow "0 sold". ProfileScreen simply doesn't pass
  // replyTime, so no reply-time segment appears there.
  soldCount?: number;
  joinedDate?: string | null;
  replyTime?: string | null;
  badges: SellerBadge[];
};

// Shared profile trust header: a muted, " · "-separated trust row (tappable
// rating · sold · joined · replies) above the earned-badge chips. Both profile
// screens render this so the two can't drift. Rating always shows (as "New"
// pre-reviews) so it isn't mistaken for missing.
export default function TrustStack({
  reviewCount,
  averageRating,
  onPressRating,
  soldCount,
  joinedDate,
  replyTime,
  badges,
}: Props) {
  const hasReviews = reviewCount > 0;

  const segments: React.ReactNode[] = [
    <TouchableOpacity
      key="rating"
      style={styles.trustSegmentRow}
      onPress={onPressRating}
      accessibilityRole="button"
      accessibilityLabel={
        hasReviews
          ? `${averageRating.toFixed(1)} stars, ${reviewCount} reviews`
          : 'No ratings yet'
      }
    >
      <Ionicons
        name={hasReviews ? 'star' : 'star-outline'}
        size={13}
        color={COLORS.warning}
      />
      <Text style={styles.trustText}>
        {hasReviews ? ` ${averageRating.toFixed(1)} (${reviewCount})` : ' New'}
      </Text>
    </TouchableOpacity>,
  ];
  if (soldCount && soldCount > 0) {
    segments.push(
      <Text key="sold" style={styles.trustText}>
        {soldCount} sold
      </Text>,
    );
  }
  if (joinedDate) {
    segments.push(
      <Text key="joined" style={styles.trustText}>
        Joined {joinedDate}
      </Text>,
    );
  }
  if (replyTime) {
    segments.push(
      <Text key="replyTime" style={styles.trustText}>
        Replies {replyTime}
      </Text>,
    );
  }

  if (segments.length === 0 && badges.length === 0) return null;

  return (
    <View style={styles.statsBlock}>
      {segments.length > 0 && (
        <View style={styles.trustRow}>
          {segments.map((segment, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text style={styles.trustDot}> · </Text>}
              {segment}
            </React.Fragment>
          ))}
        </View>
      )}
      {badges.length > 0 && (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <View key={badge.label} style={styles.badgeChip}>
              <Ionicons name={badge.icon} size={12} color={COLORS.primary} />
              <Text style={styles.badgeChipText}>{badge.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statsBlock: {
    alignItems: 'center',
    marginTop: 12,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  trustDot: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChipText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
