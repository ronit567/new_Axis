import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { haptics } from '../lib/haptics';

type Props = {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

// Reusable pill-style segmented control. The active segment reads as a raised
// white pill; screens can pass `style` to tune the container background for
// their own backdrop (e.g. translucent white on a tinted screen).
export default function SegmentedTabs({ tabs, activeIndex, onChange, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab, index) => {
        const active = index === activeIndex;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => {
              haptics.tap();
              onChange(index);
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 999,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.white,
    ...SHADOWS.card,
  },
  label: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  labelActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
