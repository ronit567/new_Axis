import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { COLORS } from '../constants/theme';
import SkeletonLoader from './SkeletonLoader';

/**
 * Placeholder that mirrors ListingCard's layout (shadow, image, heart button,
 * price/title/seller-with-dot) so the swap to real content has no layout shift.
 */
type Props = {
  animatedValue?: Animated.Value;
};

export default function ListingCardSkeleton({ animatedValue }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.imageArea}>
        <SkeletonLoader width="100%" height={128} borderRadius={0} animatedValue={animatedValue} />
        <View style={styles.heartPlaceholder} />
      </View>
      <View style={styles.info}>
        <SkeletonLoader width={42} height={15} borderRadius={5} animatedValue={animatedValue} />
        <SkeletonLoader width="95%" height={11} borderRadius={5} animatedValue={animatedValue} />
        <SkeletonLoader width="60%" height={11} borderRadius={5} animatedValue={animatedValue} />
        <View style={styles.sellerRow}>
          <SkeletonLoader width={6} height={6} borderRadius={3} animatedValue={animatedValue} />
          <SkeletonLoader width="70%" height={10} borderRadius={5} animatedValue={animatedValue} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  imageArea: {
    height: 128,
    position: 'relative',
  },
  heartPlaceholder: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  info: {
    padding: 10,
    gap: 7,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
});
