import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import PressableScale from './PressableScale';

const AUTO_HIDE_MS = 2000;
const TOOLTIP_WIDTH = 128;

export default function VerifiedTick({ size = 18 }: { size?: number }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: open ? 160 : 120,
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const handlePress = () => {
    setOpen(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  };

  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={handlePress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel="Verified student"
      >
        <Ionicons name="checkmark-circle" size={size} color={COLORS.primary} />
      </PressableScale>
      {open && (
        <Animated.View
          style={[
            styles.tooltip,
            {
              left: -(TOOLTIP_WIDTH - size) / 2,
              top: size + 7,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-4, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.arrow} />
          <View style={styles.tooltipBubble}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.white} style={styles.tooltipIcon} />
            <Text style={styles.tooltipText}>Verified student</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    alignItems: 'center',
    zIndex: 20,
    elevation: 20,
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    ...SHADOWS.raised,
  },
  tooltipIcon: {
    marginRight: 5,
  },
  tooltipText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.primaryDark,
    marginBottom: -1,
  },
});
