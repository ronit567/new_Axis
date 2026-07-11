import React, { ComponentProps } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

export default function BottomTabBar({ activeTab, onTabPress, messagesBadge = 0 }: Props) {
  const insets = useSafeAreaInsets();

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
        >
          <View style={styles.pillTint} />
          {TABS.map((tab) => {
            const isActive = activeTab === tab.name;
            const isCreate = tab.name === 'Create';

            if (isCreate) {
              return (
                <PressableScale
                  key={tab.name}
                  style={styles.tabItem}
                  onPress={() => {
                    haptics.tap();
                    onTabPress('Create');
                  }}
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
                    <Ionicons name="add" size={24} color={COLORS.white} />
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
                <View>
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.icon}
                    size={22}
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
                <Text style={[styles.label, isActive ? styles.labelActive : null]}>
                  {tab.label}
                </Text>
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
  label: {
    fontSize: 10,
    lineHeight: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  labelActive: {
    color: COLORS.primary,
    fontWeight: '600',
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
