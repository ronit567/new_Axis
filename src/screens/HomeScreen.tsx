import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PressableScale from '../components/PressableScale';
import FadeInItem from '../components/FadeInItem';
import GreetingRow from '../components/GreetingRow';
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

  const renderItem = ({ item, index }: { item: Listing; index: number }) => (
    <FadeInItem index={index} style={styles.card}>
      <ListingCard
        item={item}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
        onSave={() => toggleSavedMutation.mutate(item)}
      />
    </FadeInItem>
  );

  const ListHeader = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>For you</Text>
      <TouchableOpacity>
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
          <PressableScale
            key={cat}
            style={[
              styles.catChip,
              activeCategory === cat ? styles.catChipActive : null,
            ]}
            onPress={() => setActiveCategory(cat)}
            scaleTo={0.94}
          >
            <Text
              style={[
                styles.catLabel,
                activeCategory === cat ? styles.catLabelActive : null,
              ]}
            >
              {cat}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>

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
        <FlatList
          style={styles.contentArea}
          data={listings}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          showsVerticalScrollIndicator={false}
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
  purpleHeader: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  catLabelActive: {
    color: COLORS.white,
    fontWeight: '600',
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
    paddingBottom: 24,
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
