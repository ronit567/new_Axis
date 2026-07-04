import React, { ComponentProps } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
};

export default function BottomTabBar({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  // Split the home-indicator inset evenly above and below the row so the
  // icons sit centered in the bar instead of being shoved up by bottom padding.
  const verticalPad = Math.max(insets.bottom - 12, 10);

  return (
    <View style={[styles.container, { paddingTop: verticalPad, paddingBottom: verticalPad }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        const isCreate = tab.name === 'Create';

        return (
          <PressableScale
            key={tab.name}
            style={styles.tabItem}
            onPress={() => {
              if (!isActive) haptics.tap();
              onTabPress(tab.name);
            }}
            scaleTo={isCreate ? 0.93 : 0.9}
            accessibilityRole={isCreate ? 'button' : 'tab'}
            accessibilityLabel={isCreate ? 'Create listing' : tab.label}
            accessibilityState={isCreate ? undefined : { selected: isActive }}
          >
            {isCreate ? (
              <LinearGradient
                colors={GRADIENTS.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createBtn}
              >
                <Ionicons name="add" size={28} color={COLORS.white} />
              </LinearGradient>
            ) : (
              <>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={22}
                  color={isActive ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={[styles.label, isActive ? styles.labelActive : null]}>
                  {tab.label}
                </Text>
              </>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    shadowColor: '#150A2E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    ...SHADOWS.brand,
  },
});
