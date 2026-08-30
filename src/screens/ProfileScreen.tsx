import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  Share,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { FLOATING_TAB_BAR_CLEARANCE } from '../components/BottomTabBar';
import { RootStackParamList, MyListing } from '../types';
import PressableScale from '../components/PressableScale';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import HeaderIconButton from '../components/layout/HeaderIconButton';
import Avatar from '../components/Avatar';
import VerifiedTick from '../components/VerifiedTick';
import ReviewCard from '../components/ReviewCard';
import SegmentedTabs from '../components/SegmentedTabs';
import ReviewSummary from '../components/ReviewSummary';
import TrustStack from '../components/TrustStack';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import SkeletonLoader from '../components/SkeletonLoader';
import RemoteImage from '../components/RemoteImage';
import { useMyListings } from '../hooks/useListings';
import { useCurrentProfile } from '../hooks/useProfile';
import { useSellerReviews } from '../hooks/useReviews';
import { formatYearOfStudy } from '../lib/formatYear';
import { getSellerBadges } from '../lib/sellerBadges';
import { averageRating } from '../lib/reviewStats';

const TABS = ['Listings', 'Reviews'];

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const H_PAD = 20;
const CARD_GAP = 8;

// Thumb sizing follows the live window width (not a module-scope
// Dimensions.get snapshot) so the grid re-lays-out on rotation and on iPad
// compatibility-mode resizes — App Review exercises iPhone apps on iPad.
function thumbSize(windowWidth: number) {
  const width = (windowWidth - H_PAD * 2 - CARD_GAP * 2) / 3;
  return { width, height: Math.round(width * 0.95) };
}

function ListingThumb({ item, size }: { item: MyListing; size: { width: number; height: number } }) {
  const isSold = item.status === 'sold';
  return (
    <View style={[styles.thumb, size, { backgroundColor: item.imageColor }]}>
      {item.thumbUrls[0] ? (
        <RemoteImage uri={item.thumbUrls[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      {isSold && (
        <View style={styles.soldOverlay}>
          <Text style={styles.soldOverlayText}>SOLD</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const thumb = thumbSize(windowWidth);
  // Real own-listings preview (first 3) — mock ids here would navigate to a
  // ListingDetail that now fetches from the DB and comes back empty.
  const { data: myListings = [], refetch: refetchListings } = useMyListings();
  // RootNavigator's profile-existence gate means this is already cached by
  // the time the main app renders; the fallbacks only cover a cold refetch.
  const {
    data: profile,
    isError: profileError,
    refetch: refetchProfile,
  } = useCurrentProfile();
  // What others wrote about me (0020). Also feeds the trust row's rating
  // segment — profile.rating/reviewCount are the mapper's deferred zeros,
  // never shown.
  const { data: myReviews = [] } = useSellerReviews(profile?.id ?? '');
  const average = averageRating(myReviews);
  const [activeTab, setActiveTab] = useState(0);
  const soldCount = myListings.filter((l) => l.status === 'sold').length;

  const badges = getSellerBadges({
    averageRating: average,
    reviewCount: myReviews.length,
    replyTime: profile?.stats.replyTime ?? '',
  });

  // Spinner only for user-initiated pulls — refresh both the profile and the
  // own-listings preview together.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchListings()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile, refetchListings]);

  // A cold refetch can fail before the cached profile lands — show a retry
  // instead of a screen of blank fallbacks.
  if (profileError && !profile) {
    return (
      <Screen background="surface">
        <ErrorState
          message="Couldn't load your profile. Please try again."
          onRetry={() => refetchProfile()}
        />
      </Screen>
    );
  }

  return (
    <Screen background="surface">
      {/* Deliberately title-less: this screen's heading is the avatar and
          name directly below, and a "Profile" label would only repeat it.
          Using ScreenHeader anyway keeps the action buttons at the same
          size, spacing and inset as every other screen's. */}
      <ScreenHeader
        trailing={
          <>
            <HeaderIconButton
              icon="share-outline"
              accessibilityLabel="Share profile"
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
            />
            <HeaderIconButton
              icon="settings-outline"
              accessibilityLabel="Settings"
              onPress={() => navigation.navigate('Settings')}
            />
          </>
        }
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
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
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>{profile?.name ?? ''}</Text>
            {profile?.verified && <VerifiedTick />}
          </View>
          {profile ? (
            <Text style={styles.programText}>
              {`${profile.program} · ${formatYearOfStudy(profile.year)}`}
            </Text>
          ) : (
            <SkeletonLoader width={160} height={13} borderRadius={6} style={styles.programSkeleton} />
          )}
          {!!profile?.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

          <TrustStack
            reviewCount={myReviews.length}
            averageRating={average}
            onPressRating={() => setActiveTab(1)}
            soldCount={soldCount}
            joinedDate={profile?.joinedDate}
            badges={badges}
          />

          <PressableScale
            style={styles.actionPill}
            onPress={() => navigation.navigate('EditProfile')}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="create-outline" size={15} color={COLORS.primary} />
            <Text style={styles.actionPillText}>Edit profile</Text>
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
                    style={{ width: thumb.width }}
                    onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
                    activeOpacity={0.85}
                  >
                    <ListingThumb item={item} size={thumb} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
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
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  programText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  programSkeleton: {
    marginTop: 3,
    borderCurve: 'continuous',
  },
  bioText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 40,
    marginTop: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    ...SHADOWS.card,
  },
  actionPillText: {
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
  // width/height arrive inline from thumbSize() (live window width).
  thumb: {
    borderRadius: SIZES.borderRadiusSm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 6,
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
