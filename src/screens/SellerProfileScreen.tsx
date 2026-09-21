import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Share,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import HeaderIconButton from '../components/layout/HeaderIconButton';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import VerifiedTick from '../components/VerifiedTick';
import TrustStack from '../components/TrustStack';
import { useSellerListings } from '../hooks/useListings';
import { useToggleSaved } from '../hooks/useSavedListings';
import { useCreateReport } from '../hooks/useReports';
import { useBlockUser } from '../hooks/useBlocks';
import { useIsFollowing, useToggleFollow } from '../hooks/useFollows';
import { getSellerBadges } from '../lib/sellerBadges';
import { withGridSpacer, isGridSpacer, GridSpacer } from '../lib/gridSpacer';
import { useAuth } from '../context/AuthContext';
import { Listing, RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import Avatar from '../components/Avatar';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

// Placeholder ids so the loading grid has stable keys.
const LISTING_SKELETONS = ['sk0', 'sk1', 'sk2', 'sk3'];

// A discriminated row keeps renderItem type-safe across the listings grid and
// its loading skeletons.
type Row =
  | { type: 'skeleton'; id: string }
  | { type: 'listing'; listing: Listing };

export default function SellerProfileScreen({ navigation, route }: Props) {
  const { seller } = route.params;
  const { user } = useAuth();
  const [reportVisible, setReportVisible] = useState(false);
  const {
    data: sellerListings = [],
    isLoading: listingsLoading,
    isError: listingsError,
    refetch: refetchListings,
  } = useSellerListings(seller.id);
  // `mutate` is stable across renders; the object useMutation returns is not.
  const { mutate: toggleSaved } = useToggleSaved();
  const createReport = useCreateReport();
  const blockUser = useBlockUser();
  // Reachable with your own profile (e.g. via a chat with yourself in dev, or
  // deep links later) — hide partner-only actions rather than render a
  // "Follow yourself" button.
  const isOwnProfile = user?.id === seller.id;
  const { data: following = false } = useIsFollowing(seller.id);
  const toggleFollow = useToggleFollow();

  const badges = getSellerBadges({ replyTime: seller.stats.replyTime });

  // Spinner only for user-initiated pulls.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchListings();
    } finally {
      setRefreshing(false);
    }
  }, [refetchListings]);

  // Memoized, with stable handlers, so tapping a heart or Follow re-renders one
  // card rather than every card of a seller with a couple of hundred listings.
  // An odd count gets one trailing spacer cell, so the last card stays half
  // width in the left column instead of stretching across the row.
  const data = useMemo<(Row | GridSpacer)[]>(
    () =>
      withGridSpacer(
        listingsLoading
          ? LISTING_SKELETONS.map((id): Row => ({ type: 'skeleton', id }))
          : sellerListings.map((listing): Row => ({ type: 'listing', listing })),
      ),
    [listingsLoading, sellerListings],
  );

  const keyExtractor = useCallback(
    (item: Row | GridSpacer) =>
      isGridSpacer(item) || item.type === 'skeleton' ? item.id : item.listing.id,
    [],
  );

  const openListing = useCallback(
    (listing: Listing) => navigation.navigate('ListingDetail', { listingId: listing.id }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Row | GridSpacer }) =>
      isGridSpacer(item) ? (
        <View style={styles.gridItem} />
      ) : item.type === 'skeleton' ? (
        <View style={styles.gridItem}>
          <ListingCardSkeleton />
        </View>
      ) : (
        <View style={styles.gridItem}>
          <ListingCard item={item.listing} onPress={openListing} onSave={toggleSaved} />
        </View>
      ),
    [openListing, toggleSaved],
  );

  const ListHeader = (
    <>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <Avatar
          url={seller.avatarUrl}
          initials={seller.initials}
          color={seller.avatarColor}
          size={80}
          style={styles.avatar}
          textStyle={styles.avatarText}
        />
        <View style={styles.nameRow}>
          <Text style={styles.sellerName}>{seller.name}</Text>
          {seller.verified && <VerifiedTick />}
        </View>
        <Text style={styles.joinedText}>{seller.program}</Text>

        <TrustStack
          soldCount={seller.stats.sold}
          joinedDate={seller.joinedDate}
          replyTime={seller.stats.replyTime}
          badges={badges}
        />
      </View>

      <View style={styles.listingsHeader}>
        <Text style={styles.sectionTitle}>Listings</Text>
      </View>
    </>
  );

  const ListEmpty = listingsError ? (
    <View style={styles.stateWrap}>
      <ErrorState
        message="Couldn't load listings. Please try again."
        onRetry={() => refetchListings()}
      />
    </View>
  ) : (
    <View style={styles.stateWrap}>
      <EmptyState
        icon="storefront-outline"
        title={`${seller.name} doesn't have any active listings right now.`}
        ctaLabel="Go back"
        onCta={() => navigation.goBack()}
      />
    </View>
  );

  return (
    <Screen background="surface">
      {/* Title-less for the same reason as your own Profile: the seller's
          avatar and name lead the content directly below. */}
      <ScreenHeader
        onBack={() => navigation.goBack()}
        trailing={
          <>
            <HeaderIconButton
              icon="share-outline"
              accessibilityLabel="Share profile"
              color={COLORS.text}
              size={20}
              onPress={async () => {
                haptics.tap();
                try {
                  await Share.share({
                    message: `${seller.name} is on Axis — check out their listings`,
                  });
                } catch {
                  // Silently ignore — the user cancelling the share sheet isn't an error.
                }
              }}
            />
            {!isOwnProfile && (
              <HeaderIconButton
                icon={following ? 'bookmark' : 'bookmark-outline'}
                accessibilityLabel={following ? 'Saved — tap to remove' : 'Save profile'}
                color={following ? COLORS.primary : COLORS.text}
                size={20}
                onPress={() => {
                  haptics.tap();
                  toggleFollow.mutate({ sellerId: seller.id, next: !following });
                }}
              />
            )}
            <HeaderIconButton
              icon="ellipsis-horizontal"
              accessibilityLabel="Report or block"
              color={COLORS.text}
              size={20}
              onPress={() => {
                haptics.tap();
                setReportVisible(true);
              }}
            />
          </>
        }
      />

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      <ReportModal
        visible={reportVisible}
        target="user"
        targetName={seller.name}
        onClose={() => setReportVisible(false)}
        onSubmit={(reason) =>
          createReport.mutateAsync({ targetType: 'user', targetUserId: seller.id, reason })
        }
        onBlock={() => blockUser.mutateAsync(seller.id)}
        // Their profile and listings are RLS-hidden from the moment the block
        // lands, so there is nothing left on this screen to look at.
        onBlocked={() => navigation.goBack()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  avatar: {
    marginBottom: 14,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sellerName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  joinedText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listingsHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  gridRow: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  stateWrap: {
    flex: 1,
    minHeight: 320,
  },
});
