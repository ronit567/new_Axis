import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
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
import { RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

const TABS = ['Listings', 'Reviews'];

export default function SellerProfileScreen({ navigation, route }: Props) {
  const { seller } = route.params;
  const { user } = useAuth();
  const [reportVisible, setReportVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const { data: sellerListings = [], isLoading: listingsLoading } = useSellerListings(seller.id);
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
  const { data: reviews = [] } = useSellerReviews(seller.id);
  const upsertReview = useUpsertReview();
  const average = averageRating(reviews);
  const myReview = reviews.find((r) => r.reviewer.id === user?.id);

  const badges = getSellerBadges({
    averageRating: average,
    reviewCount: reviews.length,
    replyTime: seller.stats.replyTime,
  });

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      {/* Nav bar */}
      <View style={styles.navBar}>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </PressableScale>
        <View style={styles.navBarRight}>
          <PressableScale
            style={styles.iconBtn}
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
            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Share profile"
          >
            <Ionicons name="share-outline" size={20} color={COLORS.text} />
          </PressableScale>
          {!isOwnProfile && (
            <PressableScale
              style={styles.iconBtn}
              onPress={() => {
                haptics.tap();
                toggleFollow.mutate({ sellerId: seller.id, next: !following });
              }}
              hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={following ? 'Saved — tap to remove' : 'Save profile'}
            >
              <Ionicons
                name={following ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={following ? COLORS.primary : COLORS.text}
              />
            </PressableScale>
          )}
          <PressableScale
            style={styles.iconBtn}
            onPress={() => {
              haptics.tap();
              setReportVisible(true);
            }}
            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.text} />
          </PressableScale>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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

        {activeTab === 0 ? (
          /* Active Listings */
          <View style={styles.listingsSection}>
            {listingsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={styles.listingsLoading} />
            ) : sellerListings.length > 0 ? (
              <View style={styles.listingsGrid}>
                {sellerListings.map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
                    onSave={() => toggleSavedMutation.mutate(item)}
                    style={styles.gridCard}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="storefront-outline"
                title={`${seller.name} doesn't have any active listings right now.`}
                ctaLabel="Go back"
                onCta={() => navigation.goBack()}
              />
            )}
          </View>
        ) : (
          /* Reviews */
          <View style={styles.reviewsSection}>
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
            {reviews.length > 0 ? (
              <>
                <ReviewSummary reviews={reviews} />
                <View style={styles.reviewsList}>
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.noReviewsText}>
                No reviews yet.
                {isOwnProfile
                  ? ''
                  : hasChatted
                    ? ` Chatted with ${seller.name}? Leave the first one.`
                    : ` Reviews come from people who've chatted with ${seller.name}.`}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
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
  listingsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 14,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listingsLoading: {
    marginVertical: 24,
  },
  gridCard: {
    width: '47%',
  },
  reviewsSection: {
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
  reviewsList: {
    gap: 10,
  },
  noReviewsText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
});
