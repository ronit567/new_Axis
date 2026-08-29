import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, GRADIENTS, SHADOWS } from '../constants/theme';
import { haptics } from '../lib/haptics';
import PressableScale from './PressableScale';

export type TabName = 'Home' | 'Saved' | 'Create' | 'Messages' | 'Profile';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Tab = {
  name: TabName;
  label: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
};

const TABS: Tab[] = [
  { name: 'Home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'Saved', label: 'Saved', icon: 'heart-outline', activeIcon: 'heart' },
  { name: 'Create', label: '', icon: 'add', activeIcon: 'add' },
  { name: 'Messages', label: 'Messages', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
  { name: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

type Props = {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  // Count of conversations with unread; > 0 renders a count bubble on the Messages tab.
  messagesBadge?: number;
};

// Pill height (62) + bottom offset (~14) + a little breathing room above the
// home indicator (~24) — screens under the floating bar pad their scroll
// content by at least this much so the last item clears the glass.
export const FLOATING_TAB_BAR_CLEARANCE = 100;

// Pill geometry — kept in sync with `styles.pill`/`styles.bubble` so the layout
// math below and the visual capsule never drift apart. The selection highlight
// is a LARGE capsule "glass lens" filling almost the entire bar height and tab
// slot (iOS 26 look), not a small ring around the icon.
const PILL_HEIGHT = 62;
const BUBBLE_HEIGHT = PILL_HEIGHT - 10; // 52
// Vertically centered inside the pill: (62 - 52) / 2.
const BUBBLE_TOP = (PILL_HEIGHT - BUBBLE_HEIGHT) / 2;
// The lens spans the slot minus a small gutter. Its width depends on the
// measured slot width, so it's applied inline per layout — a static style,
// never an animated prop, which keeps the native driver happy.
const BUBBLE_SLOT_GUTTER = 8;

export default function BottomTabBar({ activeTab, onTabPress, messagesBadge = 0 }: Props) {
  const insets = useSafeAreaInsets();

  // Measured inner width of the pill; slot width = pillWidth / 5. Starts at 0
  // (unknown) and the bubble stays hidden until the first onLayout resolves it.
  const [pillWidth, setPillWidth] = useState(0);

  // Create (index 2) is never selectable — MainScreen navigates away on Create
  // and only setActiveTab()s the other four — so this always lands on 0/1/3/4.
  const activeIndex = TABS.findIndex((t) => t.name === activeTab);

  // RN Animated only (no reanimated). translateX drives the bubble between
  // slots; scaleX/scaleY give it a travel squash-&-stretch; opacity gates the
  // fly-in so the bubble never streaks in from x=0 on first render. All of these
  // are transform/opacity so every animation below is native-driver-safe.
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Tracks whether the bubble has been placed at least once (so we snap, not
  // fly, on first paint) and the last slot it settled on (so a width-only
  // change — e.g. rotation — re-snaps in place rather than springing sideways).
  const positioned = useRef(false);
  const prevIndex = useRef(activeIndex);

  // Driven by activeTab (via activeIndex), NOT onPress, so the bubble stays in
  // sync however the tab changes (deep link, back gesture, programmatic).
  useEffect(() => {
    if (pillWidth <= 0 || activeIndex < 0) return;
    const slotWidth = pillWidth / 5;
    const bubbleWidth = slotWidth - BUBBLE_SLOT_GUTTER;
    // Center the lens within the active slot (a 4px gutter each side).
    const target = activeIndex * slotWidth + (slotWidth - bubbleWidth) / 2;

    // First placement, or a width change without a tab change: snap into place
    // with no lateral fly-in. Reveal on the very first placement only.
    if (!positioned.current || prevIndex.current === activeIndex) {
      translateX.setValue(target);
      scaleX.setValue(1);
      scaleY.setValue(1);
      if (!positioned.current) {
        positioned.current = true;
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }).start();
      }
      prevIndex.current = activeIndex;
      return;
    }

    prevIndex.current = activeIndex;
    Animated.parallel([
      // Lively-but-controlled: visible overshoot, settles fast.
      Animated.spring(translateX, {
        toValue: target,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
      // Squash & stretch in the direction of travel, then spring back to 1.
      // Kept subtle — the lens is a big capsule and shouldn't wobble like jelly.
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleX, { toValue: 1.1, friction: 6, tension: 180, useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 0.94, friction: 6, tension: 180, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(scaleX, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
    // Animated.Values are stable refs; activeIndex + pillWidth are the real inputs.
  }, [activeIndex, pillWidth, translateX, scaleX, scaleY, opacity]);

  const onPillLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== pillWidth) setPillWidth(w);
  };

  // Create-button launch flourish: the plus spring-rotates 0°→90° as the
  // compose sheet takes off (a plus at 90° reads as the same glyph), then
  // quietly resets to 0 after ~400ms — the modal covers the screen by then —
  // so it's ready for the next press. Rotate interpolation on an
  // Animated.Value keeps it a pure transform: native-driver-safe.
  const createSpin = useRef(new Animated.Value(0)).current;
  const createSpinRotate = createSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });
  const createSpinReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clear a pending reset if the bar unmounts mid-flourish.
  useEffect(
    () => () => {
      if (createSpinReset.current) clearTimeout(createSpinReset.current);
    },
    [],
  );

  const handleCreatePress = () => {
    haptics.tap();
    if (createSpinReset.current) clearTimeout(createSpinReset.current);
    createSpin.setValue(0);
    // Quick energetic twist — springy enough for a hint of overshoot past 90°,
    // not a spinner.
    Animated.spring(createSpin, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
    createSpinReset.current = setTimeout(() => createSpin.setValue(0), 400);
    onTabPress('Create');
  };

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom - 6, 12) }]}
      pointerEvents="box-none"
    >
      {/* Floating pill: frosted-glass capsule holding the primary tabs and the create button. */}
      <View style={styles.pillShadowWrap}>
        <BlurView
          intensity={70}
          tint="systemChromeMaterialLight"
          style={styles.pill}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          onLayout={onPillLayout}
        >
          <View style={styles.pillTint} />
          {/* Liquid-glass selection lens. Sits ABOVE pillTint but BELOW the tab
              items so icons stay crisp on top. slotWidth is only known post-layout,
              so width is applied inline (static per-layout style — not animated);
              the whole thing is opacity-gated until layout resolves. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              pillWidth > 0 ? { width: pillWidth / 5 - BUBBLE_SLOT_GUTTER } : null,
              {
                opacity,
                transform: [{ translateX }, { scaleX }, { scaleY }],
              },
            ]}
          />
          {TABS.map((tab) => {
            const isActive = activeTab === tab.name;
            const isCreate = tab.name === 'Create';

            if (isCreate) {
              return (
                <PressableScale
                  key={tab.name}
                  style={styles.tabItem}
                  onPress={handleCreatePress}
                  scaleTo={0.93}
                  accessibilityRole="button"
                  accessibilityLabel="Create listing"
                >
                  <LinearGradient
                    colors={GRADIENTS.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.createBtn}
                  >
                    {/* Only the glyph rotates — the gradient circle stays put
                        under the PressableScale squeeze. */}
                    <Animated.View style={{ transform: [{ rotate: createSpinRotate }] }}>
                      <Ionicons name="add" size={24} color={COLORS.white} />
                    </Animated.View>
                  </LinearGradient>
                </PressableScale>
              );
            }

            return (
              <PressableScale
                key={tab.name}
                style={styles.tabItem}
                onPress={() => {
                  if (!isActive) haptics.tap();
                  onTabPress(tab.name);
                }}
                scaleTo={0.9}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
              >
                {/* Icon-only (native iOS 26 tab-bar look) — no visible label, so
                    accessibilityLabel above carries the name for screen readers. */}
                <View>
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.icon}
                    size={24}
                    color={isActive ? COLORS.primary : COLORS.textMuted}
                  />
                  {tab.name === 'Messages' && messagesBadge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {messagesBadge > 9 ? '9+' : messagesBadge}
                      </Text>
                    </View>
                  )}
                </View>
              </PressableScale>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pillShadowWrap: {
    flex: 1,
    ...SHADOWS.floating,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 12, 36, 0.08)',
  },
  pillTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.select({
      android: 'rgba(255,255,255,0.94)',
      default: 'rgba(255,255,255,0.5)',
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  // Selection lens: an elevated white glass capsule riding on the translucent
  // pill — more opaque than the frost beneath so it reads as a raised blob,
  // with a hairline dark rim and a soft lift shadow. The active icon's purple
  // provides the color pop on the white lens. `left: 0` + translateX place it;
  // `width` is applied inline once the slot width is measured.
  bubble: {
    position: 'absolute',
    left: 0,
    top: BUBBLE_TOP,
    height: BUBBLE_HEIGHT,
    borderRadius: BUBBLE_HEIGHT / 2, // true capsule
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 12, 36, 0.06)',
    shadowColor: '#150A2E',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.brand,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
