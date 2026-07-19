import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SHADOWS, FONTS, SIZES } from '../constants/theme';
import { Listing } from '../types';
import PressableScale from './PressableScale';
import RemoteImage from './RemoteImage';
import AnimatedIconToggle from './AnimatedIconToggle';

type Props = {
  item: Listing;
  onPress: () => void;
  onSave: () => void;
  style?: ViewStyle;
};

export default function ListingCard({ item, onPress, onSave, style }: Props) {
  return (
    <PressableScale style={[styles.card, style]} onPress={onPress} scaleTo={0.98}>
      <View style={[styles.imageArea, { backgroundColor: item.imageColor || '#EEE8F8' }]}>
        {item.thumbUrls[0] ? (
          <RemoteImage
            uri={item.thumbUrls[0]}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={150}
          />
        ) : null}
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
        <PressableScale
          style={styles.heartBtn}
          onPress={onSave}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <AnimatedIconToggle
            active={!!item.saved}
            activeName="heart"
            inactiveName="heart-outline"
            activeColor={COLORS.like}
            inactiveColor="rgba(0,0,0,0.28)"
            size={16}
          />
        </PressableScale>
      </View>
      <View style={styles.info}>
        <Text style={styles.price}>${item.price}</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.sellerRow}>
          <View style={[styles.dot, { backgroundColor: item.seller.dotColor || COLORS.primary }]} />
          <Text style={styles.sellerText} numberOfLines={1}>
            {item.seller.name} · {item.seller.location}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  imageArea: {
    height: 128,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.like,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 10,
  },
  price: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 7,
    lineHeight: 17,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  sellerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
  },
});
