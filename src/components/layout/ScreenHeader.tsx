import React from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../constants/theme';
import HeaderIconButton from './HeaderIconButton';

type Props = {
  // Optional so a screen can keep the shared header geometry without a
  // redundant label — Profile's identity is the avatar and name below it, and
  // stamping "Profile" above them would say nothing twice.
  title?: string;
  // `large` is the root-tab treatment (a destination you arrived at);
  // `compact` is the pushed-screen treatment (somewhere you drilled into and
  // will come back from). The split is the iOS convention, and it gives the
  // four tabs a moment the sub-screens deliberately don't get.
  variant?: 'large' | 'compact';
  onBack?: () => void;
  trailing?: React.ReactNode;
  // When supplied, the bottom hairline fades in as content scrolls beneath —
  // the header sits flush at rest and gains definition only once there is
  // something to separate it from. Home, Saved and Notifications each had
  // their own copy of this.
  scrollY?: Animated.Value;
  // A permanent hairline, for headers over content that doesn't scroll.
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenHeader({
  title,
  variant = 'compact',
  onBack,
  trailing,
  scrollY,
  bordered = false,
  style,
}: Props) {
  const isLarge = variant === 'large';

  const hairlineOpacity = scrollY?.interpolate({
    inputRange: [0, 14],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, isLarge ? styles.containerLarge : styles.containerCompact, style]}>
      <View style={styles.row}>
        {onBack ? (
          <HeaderIconButton
            icon="chevron-back"
            onPress={onBack}
            accessibilityLabel="Go back"
            color={COLORS.text}
            size={22}
          />
        ) : null}

        {isLarge ? (
          // Left-aligned and in the flow: a large title is content, and it
          // should push trailing actions aside rather than sit under them.
          <Text style={styles.titleLarge} numberOfLines={1}>
            {title}
          </Text>
        ) : title ? (
          // Absolutely centered rather than flexed, so the title stays
          // optically centered no matter how wide the trailing actions are.
          // A flex:1 title would shift left every time a screen added a
          // second action button.
          <View pointerEvents="none" style={styles.titleCompactWrap}>
            <Text style={styles.titleCompact} numberOfLines={1}>
              {title}
            </Text>
          </View>
        ) : null}

        <View style={styles.spacer} />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

      {scrollY ? (
        <Animated.View pointerEvents="none" style={[styles.hairline, { opacity: hairlineOpacity }]} />
      ) : bordered ? (
        <View pointerEvents="none" style={styles.hairline} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    // Anchors the absolutely-positioned hairline and keeps the header above
    // content that scrolls under it.
    position: 'relative',
    zIndex: 1,
  },
  containerLarge: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  containerCompact: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Holds the compact bar at a consistent height whether or not it has
    // buttons, so pushed screens don't each settle at their own height.
    minHeight: 38,
  },
  titleLarge: {
    fontSize: 28,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  titleCompactWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCompact: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  spacer: {
    flex: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    ...SHADOWS.card,
  },
});
