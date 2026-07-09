import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
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
import { useSellerListings } from '../hooks/useListings';
import { useToggleSaved } from '../hooks/useSavedListings';
import { useCreateReport } from '../hooks/useReports';
import { useBlockUser } from '../hooks/useBlocks';
import { useIsFollowing, useToggleFollow } from '../hooks/useFollows';
import { useSellerReviews, useUpsertReview } from '../hooks/useReviews';
import { getSellerBadges } from '../lib/sellerBadges';
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

  // Live rating from real reviews — seller.rating in the route param is the
  // mapper's deferred 0 and never trustworthy for display.
  const { data: reviews = [] } = useSellerReviews(seller.id);
  const upsertReview = useUpsertReview();
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
  const myReview = reviews.find((r) => r.reviewer.id === user?.id);

  // Muted trust-row segments, " · "-separated — rating (tappable, jumps to
  // the Reviews tab), sold count, and join date. seller.stats.sold is the
  // deferred zero (AX-702) until the aggregate RPC lands, so it's omitted
  // rather than shown as "0 sold".
  const trustSegments: React.ReactNode[] = [];
  if (reviews.length > 0) {
    trustSegments.push(
      <TouchableOpacity
        key="rating"
        style={styles.trustSegmentRow}
        onPress={() => setActiveTab(1)}
        accessibilityRole="button"
        accessibilityLabel={`${averageRating.toFixed(1)} stars, ${reviews.length} reviews`}
      >
        <Ionicons name="star" size={13} color={COLORS.warning} />
        <Text style={styles.trustText}> {averageRating.toFixed(1)} ({reviews.length})</Text>
      </TouchableOpacity>,
    );
  }
  if (seller.stats.sold > 0) {
    trustSegments.push(
      <Text key="sold" style={styles.trustText}>
        {seller.stats.sold} sold
      </Text>,
    );
  }
  if (seller.joinedDate) {
    trustSegments.push(
      <Text key="joined" style={styles.trustText}>
        Joined {seller.joinedDate}
      </Text>,
    );
  }

  const badges = getSellerBadges({
    averageRating,
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
          <Text style={styles.sellerName}>{seller.name}</Text>
          {seller.verified && (
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
              <Text style={styles.verifiedPillText}>Verified student</Text>
            </View>
          )}
          <Text style={styles.joinedText}>{seller.program}</Text>
          {trustSegments.length > 0 && (
            <View style={styles.trustRow}>
              {trustSegments.map((segment, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Text style={styles.trustDot}> · </Text>}
                  {segment}
                </React.Fragment>
              ))}
            </View>
          )}
          {!!seller.stats.replyTime && (
            <Text style={styles.replyTimeText}>Replies {seller.stats.replyTime}</Text>
          )}
          {badges.length > 0 && (
            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <View key={badge.label} style={styles.badgeChip}>
                  <Ionicons name={badge.icon} size={12} color={COLORS.primary} />
                  <Text style={styles.badgeChipText}>{badge.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action buttons — partner-only; no following yourself. Messaging
            is no longer offered here: chats start from a listing page or an
            existing conversation, not the profile itself. */}
        {!isOwnProfile && (
          <View style={styles.actionRow}>
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
                {isOwnProfile ? '' : ` Chatted with ${seller.name}? Leave the first one.`}
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
  sellerName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  verifiedPillText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  joinedText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trustSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  trustDot: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  replyTimeText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChipText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 28,
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
