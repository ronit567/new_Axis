import React, { useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import { NavigationProp } from '@react-navigation/native';
import { COLORS, FONTS, SIZES, SHADOWS } from '../constants/theme';
import { FLOATING_TAB_BAR_CLEARANCE } from '../components/BottomTabBar';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useSkeletonPulse } from '../hooks/useSkeletonPulse';
import { useSavedListings, useToggleSaved } from '../hooks/useSavedListings';
import { withGridSpacer, isGridSpacer, GridSpacer } from '../lib/gridSpacer';
import { useGridColumns } from '../lib/layout';
import { RootStackParamList, Listing } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
  /**
   * Switches the parent tab container to Home. Required because MainScreen
   * owns the active tab in local state, not navigation state — so this screen
   * can't reach Home with a `navigate` call: it is already rendered *inside*
   * the `Main` route, and navigating there is a no-op. Optional so the screen
   * still works if it's ever pushed as a standalone stack route, where
   * falling back to `navigate('Main')` is the correct behaviour.
   */
  onBrowseListings?: () => void;
};

export default function SavedScreen({ navigation, onBrowseListings }: Props) {
  const { data, isLoading, isError, refetch } = useSavedListings();
  // `mutate` is stable across renders; the object useMutation returns is not.
  const { mutate: toggleSaved } = useToggleSaved();
  const savedItems = useMemo(() => data ?? [], [data]);
  // Columns follow the live window width (src/lib/layout.ts). A short last row
  // is filled with spacer cells so its cards keep their width.
  const columns = useGridColumns();
  const gridData = useMemo(() => withGridSpacer(savedItems, columns), [savedItems, columns]);
  const pulseAnim = useSkeletonPulse(isLoading);

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

  // Stable so the memoized ListingCard cells skip re-rendering.
  const keyExtractor = useCallback((item: { id: string }) => item.id, []);
  const openListing = useCallback(
    (item: Listing) => navigation.navigate('ListingDetail', { listingId: item.id }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: Listing | GridSpacer }) =>
      isGridSpacer(item) ? (
        <View style={styles.card} />
      ) : (
        <ListingCard
          item={item}
          onPress={openListing}
          onSave={toggleSaved}
          style={styles.card}
        />
      ),
    [openListing, toggleSaved],
  );

  return (
    // fullWidth: a grid should gain columns on a wide window, not margins.
    <Screen fullWidth>
      {/* Fixed header block with a scroll hairline pinned to its bottom
          edge. */}
      <View style={styles.headerBlock}>
        <ScreenHeader variant="large" title="Saved" />

        <Animated.View
          pointerEvents="none"
          style={[styles.scrollHairline, { opacity: headerBorderOpacity }]}
        />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map(rowIndex => (
            <View key={rowIndex} style={styles.row}>
              {/* One skeleton per column, so the real grid lands in the same
                  geometry. */}
              {Array.from({ length: columns }, (_, i) => (
                <ListingCardSkeleton key={i} animatedValue={pulseAnim} />
              ))}
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <Animated.FlatList
          data={gridData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // Keyed on the column count: FlatList throws if numColumns changes
          // on a mounted list, and iPadOS resizes the window live.
          key={`grid-${columns}`}
          numColumns={columns}
          columnWrapperStyle={styles.row}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No saved items yet. Tap the heart on any listing to save it here."
              ctaLabel="Browse listings"
              onCta={() =>
                onBrowseListings ? onBrowseListings() : navigation.navigate('Main')
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
