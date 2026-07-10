import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, FONTS } from '../constants/theme';
import { Review } from '../types';
import { averageRating } from '../lib/reviewStats';

type Props = {
  reviews: Review[];
};

// Average rating + 5-star distribution bars, shown atop a Reviews tab once
// there's at least one review. Shared by ProfileScreen and SellerProfileScreen
// so the breakdown can't drift between the two.
export default function ReviewSummary({ reviews }: Props) {
  const total = reviews.length;
  const average = averageRating(reviews);
  const stars = Math.round(average);
  const counts = [5, 4, 3, 2, 1].map(
    (rating) => reviews.filter((r) => r.rating === rating).length,
  );

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.average}>{average.toFixed(1)}</Text>
        <View style={styles.starsRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < stars ? 'star' : 'star-outline'}
              size={13}
              color={COLORS.warning}
            />
          ))}
        </View>
        <Text style={styles.countText}>
          {total} {total === 1 ? 'review' : 'reviews'}
        </Text>
      </View>
      <View style={styles.right}>
        {counts.map((count, i) => {
          const rating = 5 - i;
          const pct = total > 0 ? count / total : 0;
          return (
            <View key={rating} style={styles.barRow}>
              <Text style={styles.barLabel}>{rating}★</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%` }]} />
              </View>
              <Text style={styles.barCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    marginBottom: 14,
    ...SHADOWS.card,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    marginRight: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.divider,
  },
  average: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
    marginVertical: 4,
  },
  countText: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  right: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    width: 20,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.divider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  barCount: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    width: 16,
    textAlign: 'right',
  },
});
