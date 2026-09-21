import { Animated, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';

type Props = {
  /** From useScrollHairline(). */
  opacity: Animated.AnimatedInterpolation<number>;
};

/**
 * The hairline that fades in under a fixed header on scroll — see
 * useScrollHairline. Absolutely positioned along the bottom edge of whatever
 * header block contains it, and never intercepts touches.
 */
export default function ScrollHairline({ opacity }: Props) {
  return <Animated.View pointerEvents="none" style={[styles.hairline, { opacity }]} />;
}

const styles = StyleSheet.create({
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
