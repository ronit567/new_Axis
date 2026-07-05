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
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useListings } from '../hooks/useListings';
import { RootStackParamList, Listing } from '../types';
import { BROWSE_CATEGORIES } from '../constants/categories';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const CATEGORIES = BROWSE_CATEGORIES;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('All');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const category = activeCategory === 'All' ? undefined : activeCategory;
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useListings(category);

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

  const toggleSave = (id: string) =>
    setSavedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const renderItem = ({ item }: { item: Listing }) => (
    <ListingCard
      item={{ ...item, saved: savedIds.includes(item.id) || item.saved }}
      onPress={() => navigation.navigate('ListingDetail', { listing: item })}
      onSave={() => toggleSave(item.id)}
      style={styles.card}
    />
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
      <View style={[styles.purpleHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarText}>RS</Text>
            </View>
            <View>
              <Text style={styles.greeting}>Hi, Ronit</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.8)" />
                <Text style={styles.location}>Western · London, ON</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
            <Text style={styles.searchPlaceholder}>Search textbooks, furniture...</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catChip,
              activeCategory === cat ? styles.catChipActive : null,
            ]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.catLabel,
                activeCategory === cat ? styles.catLabelActive : null,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
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
              onRefresh={refetch}
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
    backgroundColor: '#F5F5FA',
  },
  purpleHeader: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
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
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchPlaceholder: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4A2070',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
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
    fontWeight: '700',
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
