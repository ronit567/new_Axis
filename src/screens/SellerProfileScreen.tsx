import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import HeaderIconButton from '../components/layout/HeaderIconButton';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ReviewCard from '../components/ReviewCard';
import ReviewSummary from '../components/ReviewSummary';
import WriteReviewModal from '../components/WriteReviewModal';
import SegmentedTabs from '../components/SegmentedTabs';
import VerifiedTick from '../components/VerifiedTick';
import TrustStack from '../components/TrustStack';
import { useSellerListings } from '../hooks/useListings';
import { useToggleSaved } from '../hooks/useSavedListings';
import { useCreateReport } from '../hooks/useReports';
import { useBlockUser } from '../hooks/useBlocks';
import { useIsFollowing, useToggleFollow } from '../hooks/useFollows';
import { useHasChattedWith } from '../hooks/useMessages';
import { useSellerReviews, useUpsertReview } from '../hooks/useReviews';
import { getSellerBadges } from '../lib/sellerBadges';
import { averageRating } from '../lib/reviewStats';
import { useAuth } from '../context/AuthContext';
import { Listing, Review, RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

const TABS = ['Listings', 'Reviews'];

// Placeholder ids so the loading grid/list has stable keys.
const LISTING_SKELETONS = ['sk0', 'sk1', 'sk2', 'sk3'];
const REVIEW_SKELETONS = ['rsk0', 'rsk1', 'rsk2'];

// One list feeds both tabs; a discriminated row keeps renderItem type-safe
// across the listings grid, the reviews column, and their loading skeletons.
type Row =
  | { type: 'skeleton'; id: string }
  | { type: 'listing'; listing: Listing }
  | { type: 'review'; review: Review };

export default function SellerProfileScreen({ navigation, route }: Props) {
  const { seller } = route.params;
  const { user } = useAuth();
  const [reportVisible, setReportVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const {
    data: sellerListings = [],
    isLoading: listingsLoading,
    isError: listingsError,
    refetch: refetchListings,
  } = useSellerListings(seller.id);
  const toggleSavedMutation = useToggleSaved();
  const createReport = useCreateReport();
  const blockUser = useBlockUser();
  // Reachable with your own profile (e.g. via a chat with yourself in dev, or
  // deep links later) — hide partner-only actions rather than render a
  // "Follow yourself" button.
  const isOwnProfile = user?.id === seller.id;
  const { data: following = false } = useIsFollowing(seller.id);
  const toggleFollow = useToggleFollow();
  // Reviews are only writable by someone who's actually messaged this seller
  // (0020's reviews_insert_reviewer policy) — gate the affordance on that
  // rather than let everyone hit an RLS rejection on submit.
  const { data: hasChatted = false } = useHasChattedWith(seller.id);

  // Live rating from real reviews — seller.rating in the route param is the
  // mapper's deferred 0 and never trustworthy for display.
  const {
    data: reviews = [],
    isLoading: reviewsLoading,
    isError: reviewsError,
    refetch: refetchReviews,
  } = useSellerReviews(seller.id);
  const upsertReview = useUpsertReview();
  const average = averageRating(reviews);
  const myReview = reviews.find((r) => r.reviewer.id === user?.id);

  const badges = getSellerBadges({
    averageRating: average,
    reviewCount: reviews.length,
    replyTime: seller.stats.replyTime,
  });

  // Spinner only for user-initiated pulls, refetching whichever tab is active.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await (activeTab === 0 ? refetchListings() : refetchReviews());
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, refetchListings, refetchReviews]);

  const handleSubmitReview = async (rating: number, body: string) => {
    try {
      await upsertReview.mutateAsync({ sellerId: seller.id, rating, body });
      setReviewVisible(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      Alert.alert(
        'Review not submitted',
        // Backstop only — the UI already hides the review affordance for
        // sellers the viewer hasn't chatted with. Translates a bare RLS
        // rejection into the actual rule in case this is ever reached anyway
        // (e.g. a stale hasChatted read).
        /row-level security/i.test(message)
          ? `You can only review someone you've chatted with on Axis. Message ${seller.name} first.`
          : message || 'Please try again.',
      );
    }
  };

  const listingsData: Row[] = listingsLoading
    ? LISTING_SKELETONS.map((id): Row => ({ type: 'skeleton', id }))
    : sellerListings.map((listing): Row => ({ type: 'listing', listing }));
  const reviewsData: Row[] = reviewsLoading
    ? REVIEW_SKELETONS.map((id): Row => ({ type: 'skeleton', id }))
    : reviews.map((review): Row => ({ type: 'review', review }));
  const data = activeTab === 0 ? listingsData : reviewsData;

  const keyExtractor = (item: Row) =>
    item.type === 'skeleton'
      ? item.id
      : item.type === 'listing'
        ? item.listing.id
        : item.review.id;

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'skeleton') {
      return activeTab === 0 ? (
        <View style={styles.gridItem}>
          <ListingCardSkeleton />
        </View>
      ) : (
        <View style={styles.reviewSkeleton}>
          <SkeletonLoader width="40%" height={14} />
          <SkeletonLoader width="90%" height={12} />
          <SkeletonLoader width="70%" height={12} />
        </View>
      );
    }
    if (item.type === 'listing') {
      return (
        <View style={styles.gridItem}>
          <ListingCard
            item={item.listing}
            onPress={() => navigation.navigate('ListingDetail', { listingId: item.listing.id })}
            onSave={() => toggleSavedMutation.mutate(item.listing)}
          />
        </View>
      );
    }
    return (
      <View style={styles.reviewItem}>
        <ReviewCard review={item.review} />
      </View>
    );
  };

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
          reviewCount={reviews.length}
          averageRating={average}
          onPressRating={() => setActiveTab(1)}
          soldCount={seller.stats.sold}
          joinedDate={seller.joinedDate}
          replyTime={seller.stats.replyTime}
          badges={badges}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <SegmentedTabs tabs={TABS} activeIndex={activeTab} onChange={setActiveTab} />
      </View>

      {activeTab === 1 && (
        <View style={styles.reviewsHeaderWrap}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>
              Reviews{reviews.length > 0 ? ` (${reviews.length})` : ''}
            </Text>
            {!isOwnProfile && hasChatted && (
              <PressableScale
                onPress={() => {
                  haptics.tap();
                  setReviewVisible(true);
                }}
                scaleTo={0.95}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.writeReviewText}>
                  {myReview ? 'Edit your review' : 'Write a review'}
                </Text>
              </PressableScale>
            )}
          </View>
          {reviews.length > 0 && !reviewsLoading && !reviewsError && (
            <ReviewSummary reviews={reviews} />
          )}
        </View>
      )}
    </>
  );

  const ListEmpty =
    activeTab === 0 ? (
      listingsError ? (
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
      )
    ) : reviewsError ? (
      <View style={styles.stateWrap}>
        <ErrorState
          message="Couldn't load reviews. Please try again."
          onRetry={() => refetchReviews()}
        />
      </View>
    ) : (
      <View style={styles.emptyReviewsWrap}>
        <Text style={styles.noReviewsText}>
          No reviews yet.
          {isOwnProfile
            ? ''
            : hasChatted
              ? ` Chatted with ${seller.name}? Leave the first one.`
              : ` Reviews come from people who've chatted with ${seller.name}.`}
        </Text>
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
              accessibilityLabel="More options"
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
        key={activeTab}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={activeTab === 0 ? 2 : 1}
        columnWrapperStyle={activeTab === 0 ? styles.gridRow : undefined}
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

      <WriteReviewModal
        visible={reviewVisible}
        sellerName={seller.name}
        initialRating={myReview?.rating}
        initialBody={myReview?.body}
        submitting={upsertReview.isPending}
        onClose={() => setReviewVisible(false)}
        onSubmit={handleSubmitReview}
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
  tabsWrap: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
  reviewsHeaderWrap: {
    paddingHorizontal: 20,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  writeReviewText: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  reviewItem: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  reviewSkeleton: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  emptyReviewsWrap: {
    paddingHorizontal: 20,
  },
  noReviewsText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  stateWrap: {
    flex: 1,
    minHeight: 320,
  },
});
