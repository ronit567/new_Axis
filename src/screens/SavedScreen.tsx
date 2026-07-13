import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SHADOWS } from '../constants/theme';
import { FLOATING_TAB_BAR_CLEARANCE } from '../components/BottomTabBar';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import ActivitySpinner from '../components/ActivitySpinner';
import Avatar from '../components/Avatar';
import PressableScale from '../components/PressableScale';
import { useSavedListings, useToggleSaved } from '../hooks/useSavedListings';
import { useFollowing, useToggleFollow } from '../hooks/useFollows';
import { formatYearOfStudy } from '../lib/formatYear';
import { haptics } from '../lib/haptics';
import { RootStackParamList, Listing, SellerProfile } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const TABS = ['Items', 'Saved profiles'];

export default function SavedScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState('Items');
  const { data, isLoading, isError, refetch } = useSavedListings();
  const toggleSavedMutation = useToggleSaved();
  const savedItems = data ?? [];
  const { data: following, isPending: isFollowingPending } = useFollowing();
  const toggleFollow = useToggleFollow();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Hairline + shadow under the fixed header/tabs, faded in on scroll so the
  // header stays flush at rest and gains definition as content passes under it.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [0, 14],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    if (isLoading) anim.start();
    else { anim.stop(); pulseAnim.setValue(0.4); }
    return () => anim.stop();
  }, [isLoading, pulseAnim]);

  // Stable so the memoized ListingCard cells skip re-rendering on tab switches.
  const keyExtractor = useCallback((item: { id: string }) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Listing }) => (
      <ListingCard
        item={item}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
        onSave={() => toggleSavedMutation.mutate(item)}
        style={styles.card}
      />
    ),
    [navigation, toggleSavedMutation],
  );

  const renderProfileRow = ({ item }: { item: SellerProfile }) => (
    <PressableScale
      style={styles.profileRow}
      onPress={() => navigation.navigate('SellerProfile', { seller: item })}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}'s profile`}
    >
      <Avatar
        url={item.avatarUrl}
        initials={item.initials}
        color={item.avatarColor}
        size={44}
        textStyle={styles.profileAvatarText}
      />
      <View style={styles.profileRowInfo}>
        <View style={styles.profileNameRow}>
          <Text style={styles.profileName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.verified && (
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
          )}
        </View>
        <Text style={styles.profileProgram} numberOfLines={1}>
          {item.program} · {formatYearOfStudy(item.year)}
        </Text>
      </View>
      <PressableScale
        style={styles.unfollowBtn}
        onPress={() => {
          haptics.tap();
          toggleFollow.mutate({ sellerId: item.id, next: false });
        }}
        scaleTo={0.94}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`Unfollow ${item.name}`}
      >
        <Text style={styles.unfollowText}>Saved</Text>
      </PressableScale>
    </PressableScale>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Fixed header block (title + tabs) with a scroll hairline pinned to
          its bottom edge. */}
      <View style={styles.headerBlock}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Saved</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <PressableScale
                key={tab}
                style={[styles.tab, isActive ? styles.tabActive : null]}
                onPress={() => {
                  haptics.tap();
                  setActiveTab(tab);
                }}
                scaleTo={0.96}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>
                  {tab === 'Items' ? `Items  ${savedItems.length}` : `Saved profiles  ${(following ?? []).length}`}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.scrollHairline, { opacity: headerBorderOpacity }]}
        />
      </View>

      {isLoading && activeTab === 'Items' ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map(rowIndex => (
            <View key={rowIndex} style={styles.row}>
              <ListingCardSkeleton animatedValue={pulseAnim} />
              <ListingCardSkeleton animatedValue={pulseAnim} />
            </View>
          ))}
        </View>
      ) : isError && activeTab === 'Items' ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : activeTab === 'Items' ? (
        <Animated.FlatList
          data={savedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No saved items yet. Tap the heart on any listing to save it here."
              ctaLabel="Browse listings"
              onCta={() => navigation.navigate('Main')}
            />
          }
        />
      ) : isFollowingPending ? (
        <ActivitySpinner style={styles.spinner} />
      ) : (
        <Animated.FlatList
          data={following ?? []}
          renderItem={renderProfileRow}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.profileListContent}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No saved profiles yet. Bookmark sellers to find them again quickly."
              ctaLabel="Browse listings"
              onCta={() => navigation.navigate('Main')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  headerBlock: {
    position: 'relative',
    zIndex: 1,
  },
  scrollHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    ...SHADOWS.card,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
  },
  spinner: {
    marginTop: 48,
  },
  profileListContent: {
    padding: 20,
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
    gap: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    padding: 12,
    ...SHADOWS.card,
  },
  profileAvatarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  profileRowInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  profileName: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
  },
  profileProgram: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  unfollowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  unfollowText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
