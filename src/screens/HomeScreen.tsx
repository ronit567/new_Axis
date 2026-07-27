import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { COLORS, GRADIENTS, SHADOWS, FONTS } from '../constants/theme';
import { FLOATING_TAB_BAR_CLEARANCE } from '../components/BottomTabBar';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import CategoryChip from '../components/CategoryChip';
import FadeInItem from '../components/FadeInItem';
import GreetingRow from '../components/GreetingRow';
import { haptics } from '../lib/haptics';
import { useListings } from '../hooks/useListings';
import { useToggleSaved } from '../hooks/useSavedListings';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useCurrentProfile } from '../hooks/useProfile';
import { RootStackParamList, Listing } from '../types';
import { BROWSE_CATEGORIES } from '../constants/categories';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const CATEGORIES = BROWSE_CATEGORIES;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('All');
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Hairline + shadow under the fixed header/chips that fades in as the list
  // scrolls beneath it, so the header gains definition on scroll and stays
  // flush (looking exactly like today) at rest.
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

  // Hand-rolled search transition (the Search route uses animation: 'none').
  // Home navigates immediately and Search mounts with the exact same header
  // geometry — greeting expanded, full-width bar, no side buttons — then
  // collapses the greeting and grows the buttons in on its own timeline. So
  // the whole entrance (swipe-up + buttons appearing) runs at once on Search.
  const openSearch = (showFilters?: boolean) => {
    navigation.navigate('Search', showFilters ? { showFilters } : undefined);
  };

  const category = activeCategory === 'All' ? undefined : activeCategory;
  const {
    data,
    isLoading,
    isError,
    refetch,
    refreshFirstPage,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useListings(category);
  const toggleSavedMutation = useToggleSaved();
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount();
  const { data: profile } = useCurrentProfile();
  const firstName = profile?.name.trim().split(/\s+/)[0] ?? '';

  const listings = data?.pages.flatMap(page => page.items) ?? [];

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

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  // Stable across re-renders so the memoized ListingCard cells don't re-render
  // when unrelated parent state changes (e.g. a category switch).
  const renderItem = useCallback(
    ({ item, index }: { item: Listing; index: number }) => (
      <FadeInItem index={index} style={styles.card}>
        <ListingCard
          item={item}
          onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
          onSave={() => toggleSavedMutation.mutate(item)}
        />
      </FadeInItem>
    ),
    [navigation, toggleSavedMutation],
  );

  const keyExtractor = useCallback((item: Listing) => item.id, []);

  const ListHeader = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>For you</Text>
      {/* Was a bare TouchableOpacity with no onPress — it rendered as a live
          control but did nothing on tap. Routed to Search, which is the
          browse-everything surface this label promises. */}
      <TouchableOpacity
        onPress={() => {
          haptics.tap();
          openSearch();
        }}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityRole="button"
        accessibilityLabel="See all listings"
      >
        <Text style={styles.seeAll}>See all</Text>
      </TouchableOpacity>
    </View>
  );

  const ListFooter = isFetchingNextPage ? (
    <View style={styles.footerLoading}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  ) : null;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      {/* Fixed header block (purple header + category chips). The scroll
          hairline pins to its bottom edge so list content gains a defining
          line as it slides under. */}
      <View style={styles.headerBlock}>
      {/* Purple curved header */}
      <LinearGradient
        colors={GRADIENTS.primaryRadiant}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.purpleHeader, { paddingTop: insets.top + 8 }]}
      >
        <GreetingRow
          avatarUrl={profile?.avatarUrl}
          initials={profile?.initials ?? ''}
          firstName={firstName}
          unreadCount={unreadNotifications}
          onBellPress={() => navigation.navigate('Notifications')}
        />

        {/* Search Bar — filters live inside Search, not here. */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => openSearch()}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
            <Text style={styles.searchPlaceholder}>Search textbooks, furniture...</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map(cat => (
          <CategoryChip
            key={cat}
            label={cat}
            active={activeCategory === cat}
            onPress={() => {
              haptics.tap();
              setActiveCategory(cat);
            }}
          />
        ))}
      </ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[styles.scrollHairline, { opacity: headerBorderOpacity }]}
      />
      </View>

      {/* Content: loading skeleton / error / listing grid */}
      {isLoading ? (
        <ScrollView style={styles.contentArea} contentContainerStyle={styles.listContent}>
          {ListHeader}
          {[0, 1, 2].map(rowIndex => (
            <View key={rowIndex} style={styles.row}>
              <ListingCardSkeleton animatedValue={pulseAnim} />
              <ListingCardSkeleton animatedValue={pulseAnim} />
            </View>
          ))}
        </ScrollView>
      ) : isError && listings.length === 0 ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <Animated.FlatList
          style={styles.contentArea}
          data={listings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.row}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listings.length > 0 ? ListHeader : null}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title={`No listings in ${activeCategory} yet.`}
              ctaLabel="Browse all listings"
              onCta={() => setActiveCategory('All')}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refreshFirstPage}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  headerBlock: {
    // Relative anchor for the absolutely-positioned scroll hairline; adds no
    // padding/margin so the header geometry is unchanged.
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
  purpleHeader: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderCurve: 'continuous',
    paddingBottom: 18,
    ...SHADOWS.floating,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
    ...SHADOWS.card,
  },
  searchPlaceholder: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  contentArea: {
    flex: 1,
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
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
