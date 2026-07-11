import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { haptics } from '../lib/haptics';

type Props = {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

// Reusable pill-style segmented control, styled after UISegmentedControl: a
// single white thumb slides behind the labels rather than each segment
// swapping its own background. Screens can pass `style` to tune the
// container background for their own backdrop (e.g. translucent white on a
// tinted screen) — it stays after the base style so it can override the
// track color.
export default function SegmentedTabs({ tabs, activeIndex, onChange, style }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const thumbWidth = containerWidth > 0 ? (containerWidth - 4) / tabs.length : 0;

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (thumbWidth === 0) return;
    Animated.spring(translateX, {
      toValue: activeIndex * thumbWidth,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [activeIndex, thumbWidth, translateX]);

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {thumbWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { width: thumbWidth, transform: [{ translateX }] },
          ]}
        />
      )}
      {tabs.map((tab, index) => {
        const active = index === activeIndex;
        return (
          <TouchableOpacity
            key={tab}
            style={styles.segment}
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
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 999,
    padding: 2,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  labelActive: {
    color: COLORS.primary,
  },
});
