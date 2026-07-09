import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';
import { Review } from '../types';

type Props = {
  review: Review;
};

// One written review: reviewer identity, star rating, relative time, body.
// Shared by SellerProfileScreen and the own Profile tab so the two renderings
// can't drift.
export default function ReviewCard({ review }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: review.reviewer.avatarColor }]}>
          <Text style={styles.avatarText}>{review.reviewer.initials}</Text>
        </View>
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
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  body: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
});
