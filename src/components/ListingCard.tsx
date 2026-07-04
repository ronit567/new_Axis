import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { Listing } from '../types';

type Props = {
  item: Listing;
  onPress: () => void;
  onSave: () => void;
  style?: ViewStyle;
};

export default function ListingCard({ item, onPress, onSave, style }: Props) {
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.92}>
      <View style={[styles.imageArea, { backgroundColor: item.imageColor || '#EEE8F8' }]}>
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onSave}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons
            name={item.saved ? 'heart' : 'heart-outline'}
            size={16}
            color={item.saved ? '#E63946' : 'rgba(0,0,0,0.28)'}
          />
        </TouchableOpacity>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20, 12, 36, 0.05)',
    ...SHADOWS.card,
  },
  imageArea: {
    height: 128,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E63946',
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
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
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
