import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import ReviewCard from '../components/ReviewCard';
import SegmentedTabs from '../components/SegmentedTabs';
import ReviewSummary from '../components/ReviewSummary';
import EmptyState from '../components/EmptyState';
import { useMyListings } from '../hooks/useListings';
import { useCurrentProfile } from '../hooks/useProfile';
import { useFollowing } from '../hooks/useFollows';
import { useSellerReviews } from '../hooks/useReviews';
import { formatYearOfStudy } from '../lib/formatYear';
import { getSellerBadges } from '../lib/sellerBadges';

const TABS = ['Listings', 'Reviews'];

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const { width } = Dimensions.get('window');
const H_PAD = 24;
const CARD_GAP = 8;
const THUMB_WIDTH = (width - H_PAD * 2 - CARD_GAP * 2) / 3;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * 0.95);

function HatchedThumb({ isSold }: { isSold: boolean }) {
  return (
    <View
      style={[
        styles.thumb,
        { backgroundColor: isSold ? '#C0BCBC' : '#C4B2E0' },
      ]}
    >
      {Array.from({ length: 30 }).map((_, i) => (
        <View key={i} style={[styles.hatchLine, { top: i * 9 - 20 }]} />
      ))}
      {isSold && (
        <View style={styles.soldOverlay}>
          <Text style={styles.soldOverlayText}>SOLD</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  // Real own-listings preview (first 3) — mock ids here would navigate to a
  // ListingDetail that now fetches from the DB and comes back empty.
  const { data: myListings = [] } = useMyListings();
  // RootNavigator's profile-existence gate means this is already cached by
  // the time the main app renders; the fallbacks only cover a cold refetch.
  const { data: profile } = useCurrentProfile();
  const { data: followingList = [] } = useFollowing();
  // What others wrote about me (0020). Also feeds the trust row's rating
  // segment — profile.rating/reviewCount are the mapper's deferred zeros,
  // never shown.
  const { data: myReviews = [] } = useSellerReviews(profile?.id ?? '');
  const averageRating =
    myReviews.length > 0
      ? myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length
      : 0;
  const [activeTab, setActiveTab] = useState(0);
  const soldCount = myListings.filter((l) => l.status === 'sold').length;

  // Muted trust-row segments, " · "-separated — rating (tappable, jumps to
  // the Reviews tab), sold count, and join date. Each is omitted when not
  // applicable rather than showing a hollow "0 sold".
  const trustSegments: React.ReactNode[] = [];
  if (myReviews.length > 0) {
    trustSegments.push(
      <TouchableOpacity
        key="rating"
        style={styles.trustSegmentRow}
        onPress={() => setActiveTab(1)}
        accessibilityRole="button"
        accessibilityLabel={`${averageRating.toFixed(1)} stars, ${myReviews.length} reviews`}
      >
        <Ionicons name="star" size={13} color={COLORS.warning} />
        <Text style={styles.trustText}> {averageRating.toFixed(1)} ({myReviews.length})</Text>
      </TouchableOpacity>,
    );
  }
  if (soldCount > 0) {
    trustSegments.push(
      <Text key="sold" style={styles.trustText}>
        {soldCount} sold
      </Text>,
    );
  }
  if (profile?.joinedDate) {
    trustSegments.push(
      <Text key="joined" style={styles.trustText}>
        Joined {profile.joinedDate}
      </Text>,
    );
  }

  const badges = getSellerBadges({
    averageRating,
    reviewCount: myReviews.length,
    replyTime: profile?.stats.replyTime ?? '',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar (share + gear icons) ── */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.gearBtn}
            onPress={async () => {
              if (!profile) return;
              try {
                await Share.share({
                  message: `${profile.name} is on Axis — check out their listings`,
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
            <Ionicons name="share-outline" size={18} color={COLORS.textSecondary} />
          </PressableScale>
          <PressableScale
            style={styles.gearBtn}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
            scaleTo={0.9}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
          </PressableScale>
        </View>

        {/* ── Profile info ── */}
        <View style={styles.profileSection}>
          <Avatar
            url={profile?.avatarUrl}
            initials={profile?.initials ?? ''}
            color={profile?.avatarColor ?? '#C4B2E0'}
            size={80}
            style={styles.avatar}
            textStyle={styles.avatarText}
          />
          <Text style={styles.nameText}>{profile?.name ?? ''}</Text>
          {profile?.verified && (
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
              <Text style={styles.verifiedPillText}>Verified student</Text>
            </View>
          )}
          <Text style={styles.programText}>
            {profile ? `${profile.program} · ${formatYearOfStudy(profile.year)}` : ' '}
          </Text>
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
          {!!profile?.bio && <Text style={styles.bioText}>{profile.bio}</Text>}
          <TouchableOpacity
            style={styles.followingLink}
            onPress={() => navigation.navigate('Following')}
            accessibilityRole="button"
            accessibilityLabel={`${followingList.length} saved ${followingList.length === 1 ? 'profile' : 'profiles'}`}
          >
            <Text style={styles.followingLinkText}>
              {followingList.length} Saved {followingList.length === 1 ? 'profile' : 'profiles'}
            </Text>
          </TouchableOpacity>
          <PressableScale
            style={styles.editPill}
            onPress={() => navigation.navigate('EditProfile')}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="create-outline" size={15} color={COLORS.primary} />
            <Text style={styles.editPillText}>Edit profile</Text>
          </PressableScale>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabsWrap}>
          <SegmentedTabs tabs={TABS} activeIndex={activeTab} onChange={setActiveTab} />
        </View>

        {activeTab === 0 ? (
          /* ── My Listings ── */
          <View style={styles.listingsBlock}>
            <View style={styles.listingsTopRow}>
              <Text style={styles.listingsTitle}>My listings</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ManageListings')}>
                <Text style={styles.manageText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {myListings.length > 0 ? (
              <View style={styles.listingsRow}>
                {myListings.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.listingItem}
                    onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
                    activeOpacity={0.85}
                  >
                    <HatchedThumb isSold={item.status === 'sold'} />
                    <Text
                      style={[
                        styles.priceText,
                        item.status === 'sold' ? styles.priceTextSold : null,
                      ]}
                    >
                      ${item.status === 'sold' ? item.soldFor ?? item.price : item.price}
                    </Text>
                    <Text style={styles.statusText}>
                      {item.status === 'sold' ? 'Sold' : 'Active'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="storefront-outline"
                title="No listings yet — post your first item."
                ctaLabel="Post a listing"
                onCta={() => navigation.navigate('CreateListing')}
              />
            )}
          </View>
        ) : (
          /* ── Reviews about me ── */
          <View style={styles.reviewsBlock}>
            <Text style={styles.listingsTitle}>Reviews ({myReviews.length})</Text>
            {myReviews.length > 0 ? (
              <>
                <ReviewSummary reviews={myReviews} />
                <View style={styles.reviewsList}>
                  {myReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.noListingsText}>
                No reviews yet — they&apos;ll show up after your first sale.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EDEAF6',
  },
  scroll: {
    paddingBottom: 20,
  },

  /* top bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 8,
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* profile */
  profileSection: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  avatar: {
    marginBottom: 12,
  },
  avatarText: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  nameText: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  verifiedPillText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  programText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChipText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bioText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 40,
    marginBottom: 6,
  },
  followingLink: {
    marginBottom: 10,
  },
  followingLinkText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    ...SHADOWS.card,
  },
  editPillText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },

  /* tabs */
  tabsWrap: {
    marginHorizontal: H_PAD,
    marginBottom: 16,
  },

  /* listings */
  listingsBlock: {
    marginHorizontal: H_PAD,
    marginBottom: 16,
  },
  listingsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listingsTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  manageText: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  listingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  listingItem: {
    width: THUMB_WIDTH,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: SIZES.borderRadiusSm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 6,
  },
  hatchLine: {
    position: 'absolute',
    width: 220,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.42)',
    transform: [{ rotate: '-45deg' }],
    left: -60,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlayText: {
    color: COLORS.white,
    fontSize: SIZES.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  priceText: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  priceTextSold: {
    color: COLORS.textMuted,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  noListingsText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },

  /* reviews */
  reviewsBlock: {
    marginHorizontal: H_PAD,
    marginTop: 8,
  },
  reviewsList: {
    gap: 10,
    marginTop: 12,
  },
});
