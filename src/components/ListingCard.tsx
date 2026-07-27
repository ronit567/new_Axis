import React, { useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, FONTS, SIZES } from '../constants/theme';
import { Listing } from '../types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import PressableScale from './PressableScale';
import RemoteImage from './RemoteImage';
import AnimatedIconToggle from './AnimatedIconToggle';

type Props = {
  item: Listing;
  onPress: () => void;
  onSave: () => void;
  style?: ViewStyle;
};

const CARD_SCALE_TO = 0.98;

function ListingCard({ item, onPress, onSave, style }: Props) {
  // Shared with PressableScale so the image can be choreographed against the
  // same press rather than animated on a second, slightly-out-of-sync timeline.
  const press = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  // The card sinks while the photo pushes very slightly *outward*. That
  // opposition is what sells depth: the frame recedes, the artwork stays
  // forward, like glass over a print. Matched to the card's own spring, so
  // both settle together.
  const imageScale = press.interpolate({
    inputRange: [CARD_SCALE_TO, 1],
    outputRange: [1.05, 1],
  });

  return (
    <PressableScale
      style={[styles.card, style]}
      onPress={onPress}
      scaleTo={CARD_SCALE_TO}
      scaleValue={press}
    >
      <View style={[styles.imageArea, { backgroundColor: item.imageColor || '#EEE8F8' }]}>
        {item.thumbUrls[0] ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              reducedMotion ? null : { transform: [{ scale: imageScale }] },
            ]}
          >
            <RemoteImage
              uri={item.thumbUrls[0]}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={220}
            />
          </Animated.View>
        ) : null}
        {/* Guarantees the badge and heart keep contrast over a bright or busy
            photo, instead of relying on the image happening to be dark there.
            Top-weighted because that's where both overlays sit. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(10,4,24,0.28)', 'rgba(10,4,24,0.06)', 'transparent']}
          locations={[0, 0.55, 1]}
          style={styles.scrim}
        />
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
        <PressableScale
          style={styles.heartBtn}
          onPress={onSave}
          scaleTo={0.86}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel={item.saved ? 'Remove from saved' : 'Save listing'}
        >
          {/* Frosted rather than flat white — the same glass vocabulary as the
              floating tab bar, so the app's translucent surfaces feel like one
              material instead of two unrelated treatments. */}
          <BlurView intensity={38} tint="light" style={styles.heartBlur}>
            <AnimatedIconToggle
              active={!!item.saved}
              activeName="heart"
              inactiveName="heart-outline"
              activeColor={COLORS.like}
              inactiveColor="rgba(20,10,40,0.45)"
              size={16}
            />
          </BlurView>
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

// Memoized so a parent re-render (e.g. Home category switch) doesn't re-render
// every card — relies on the screens passing stable onPress/onSave callbacks.
export default React.memo(ListingCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  imageArea: {
    height: 128,
    position: 'relative',
    // Clips the counter-scaled image to the frame, so the zoom on press reads
    // as movement behind the card rather than the photo spilling over it.
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.like,
    borderRadius: 5,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    // The blur child is clipped to this radius; without it the BlurView
    // renders as a square patch over the photo.
    overflow: 'hidden',
  },
  heartBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
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
