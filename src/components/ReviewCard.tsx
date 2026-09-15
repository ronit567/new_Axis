import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';
import { haptics } from '../lib/haptics';
import { Review } from '../types';
import Avatar from './Avatar';
import PressableScale from './PressableScale';

type Props = {
  review: Review;
  // Report someone else's review. Omitted on your own, where there is nothing
  // to report — you can delete it instead.
  onReport?: () => void;
  // Withdraw your own review. Omitted on everyone else's.
  onDelete?: () => void;
};

// One written review: reviewer identity, star rating, relative time, body.
// Shared by SellerProfileScreen and the own Profile tab so the two renderings
// can't drift.
//
// The overflow action only appears when the parent passes a handler, so a card
// never offers something the viewer cannot do. Exactly one of the two applies
// at a time: you can report a review you did not write, or delete one you did.
export default function ReviewCard({ review, onReport, onDelete }: Props) {
  const hasMenu = !!onReport || !!onDelete;

  const openMenu = () => {
    haptics.tap();
    if (onDelete) {
      Alert.alert(
        'Delete your review',
        'This removes your review of this seller. You can write a new one later.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ],
      );
      return;
    }
    onReport?.();
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Avatar
          url={review.reviewer.avatarUrl}
          initials={review.reviewer.initials}
          color={review.reviewer.avatarColor}
          size={32}
          textStyle={styles.avatarText}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {review.reviewer.name}
          </Text>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < review.rating ? 'star' : 'star-outline'}
                size={12}
                color={COLORS.warning}
              />
            ))}
          </View>
        </View>
        <Text style={styles.time}>{review.timeAgo}</Text>
        {hasMenu && (
          <PressableScale
            style={styles.menuBtn}
            onPress={openMenu}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={onDelete ? 'Delete your review' : 'Report this review'}
          >
            <Ionicons
              name={onDelete ? 'trash-outline' : 'flag-outline'}
              size={15}
              color={COLORS.textMuted}
            />
          </PressableScale>
        )}
      </View>
      <Text style={styles.body}>{review.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    padding: 14,
    ...SHADOWS.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  time: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  menuBtn: {
    padding: 4,
    marginRight: -4,
  },
  body: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
});
