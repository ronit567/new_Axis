import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import ReviewCard from '../components/ReviewCard';
import WriteReviewModal from '../components/WriteReviewModal';
import { useSellerListings } from '../hooks/useListings';
import { useToggleSaved } from '../hooks/useSavedListings';
import { useCreateReport } from '../hooks/useReports';
import { useBlockUser } from '../hooks/useBlocks';
import { useIsFollowing, useToggleFollow } from '../hooks/useFollows';
import { useSellerReviews, useUpsertReview } from '../hooks/useReviews';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

export default function SellerProfileScreen({ navigation, route }: Props) {
  const { seller } = route.params;
  const { user } = useAuth();
  const [reportVisible, setReportVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
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

  // Live rating from real reviews — seller.rating in the route param is the
  // mapper's deferred 0 and never trustworthy for display.
  const { data: reviews = [] } = useSellerReviews(seller.id);
  const upsertReview = useUpsertReview();
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
  const stars = Math.round(averageRating);
  const myReview = reviews.find((r) => r.reviewer.id === user?.id);

  const handleSubmitReview = async (rating: number, body: string) => {
    try {
      await upsertReview.mutateAsync({ sellerId: seller.id, rating, body });
      setReviewVisible(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      Alert.alert(
        'Review not submitted',
        // The 0020 INSERT policy requires an existing chat with the seller —
        // translate its bare RLS rejection into the actual rule.
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
          </View>
          <Text style={styles.joinedText}>
            {seller.program} · Joined {seller.joinedDate}
          </Text>
          {!!seller.stats.replyTime && (
            <Text style={styles.replyTimeText}>Replies {seller.stats.replyTime}</Text>
          )}
          {/* Hidden until reviews exist rather than showing an empty
              zero-star "0 (0 reviews)". */}
          {reviews.length > 0 && (
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < stars ? 'star' : 'star-outline'}
                  size={14}
                  color={COLORS.warning}
                />
              ))}
              <Text style={styles.ratingText}>
                {averageRating.toFixed(1)} ({reviews.length}{' '}
                {reviews.length === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}
        </View>

        {/* Stats row. Listings comes from the real active listings we fetch
            below so the count can't contradict the grid. Sold stays from the
            profile (0 for now): listings_select_public (0002) only exposes a
            seller's ACTIVE listings to non-owners, so another user's sold
            count isn't queryable client-side — it needs the deferred
            aggregate RPC (AX-702), same as rating/reviewCount. */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sellerListings.length}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{seller.stats.sold}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            {reviews.length > 0 ? (
              <View style={styles.statValueRow}>
                <Ionicons name="star" size={16} color={COLORS.warning} />
                <Text style={styles.statValue}> {averageRating.toFixed(1)}</Text>
              </View>
            ) : (
              <Text style={styles.statValue}>—</Text>
            )}
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Action buttons — partner-only; there's no messaging or following
            yourself. */}
        {!isOwnProfile && (
          <View style={styles.actionRow}>
            <PressableScale
              style={styles.messageBtn}
              scaleTo={0.97}
              onPress={() => {
                haptics.tap();
                // No listing context from a profile page — this opens (or
                // continues) the general thread with this seller.
                navigation.navigate('Chat', {
                  listingId: null,
                  partnerId: seller.id,
                  partner: {
                    id: seller.id,
                    initials: seller.initials,
                    name: seller.name,
                    avatarColor: seller.avatarColor,
                    avatarUrl: seller.avatarUrl,
                  },
                });
              }}
            >
              <Text style={styles.messageBtnText}>Message</Text>
            </PressableScale>
            <PressableScale
              style={[styles.followBtn, following ? styles.followBtnActive : null]}
              scaleTo={0.97}
              onPress={() => {
                haptics.tap();
                toggleFollow.mutate({ sellerId: seller.id, next: !following });
              }}
            >
              <Text style={[styles.followBtnText, following ? styles.followBtnTextActive : null]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </PressableScale>
          </View>
        )}

        {/* Active Listings */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>Active listings</Text>
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

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>
              Reviews{reviews.length > 0 ? ` (${reviews.length})` : ''}
            </Text>
            {!isOwnProfile && (
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
            <View style={styles.reviewsList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </View>
          ) : (
            <Text style={styles.noReviewsText}>
              No reviews yet.
              {isOwnProfile ? '' : ` Chatted with ${seller.name}? Leave the first one.`}
            </Text>
          )}
        </View>
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
    gap: 8,
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
    marginBottom: 8,
  },
  replyTimeText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    marginBottom: 3,
    fontVariant: ['tabular-nums'],
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  messageBtn: {
    flex: 1,
    height: 48,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.brand,
  },
  messageBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  followBtn: {
    flex: 1,
    height: 48,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  followBtnActive: {
    backgroundColor: COLORS.primarySoft,
  },
  followBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  followBtnTextActive: {
    color: COLORS.primary,
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
    marginTop: 28,
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
