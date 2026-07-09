import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types';
import RemoteImage from '../components/RemoteImage';
import ReportModal from '../components/ReportModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PressableScale from '../components/PressableScale';
import AnimatedIconToggle from '../components/AnimatedIconToggle';
import { haptics } from '../lib/haptics';
import { formatYearOfStudy } from '../lib/formatYear';
import { useAuth } from '../context/AuthContext';
import { useListing, useMarkListingSold, useRelistListing, useDeleteListing } from '../hooks/useListings';
import { useToggleSaved } from '../hooks/useSavedListings';
import { usePendingEditRequest } from '../hooks/useListingEdits';
import { useProfile } from '../hooks/useProfile';
import { useCreateReport } from '../hooks/useReports';
import { deriveInitials, sellerToContact } from '../repositories/mappers';

type Props = NativeStackScreenProps<RootStackParamList, 'ListingDetail'>;

export default function ListingDetailScreen({ navigation, route }: Props) {
  const { listingId } = route.params;
  const { data: listing, isLoading, isError, refetch } = useListing(listingId);
  // Fetched alongside the listing so tapping through to the seller card has
  // real data ready; the nested `listing.seller` is a lightweight summary,
  // not the full SellerProfile the SellerProfile screen needs.
  const { data: sellerProfile } = useProfile(listing?.seller.id ?? '');
  const toggleSavedMutation = useToggleSaved();
  const createReport = useCreateReport();
  const markSold = useMarkListingSold();
  const relist = useRelistListing();
  const deleteListing = useDeleteListing();

  const [saved, setSaved] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const galleryRef = useRef<ScrollView>(null);

  const isOwnListing = !!listing && user?.id === listing.seller.id;
  // Owner-guarded: a viewer browsing someone else's listing has no edit
  // requests of their own to see for it (listing_edit_requests_select_own
  // scopes rows to the requester, always the seller), so skip the query
  // entirely rather than fire a request that would just resolve to null.
  const { data: pendingEditRequest } = usePendingEditRequest(isOwnListing ? listingId : '');

  // `saved` is optimistic local state: flip immediately, roll back on failure.
  // The mutation takes the full listing with the pre-tap saved flag — local
  // state may be ahead of the query cache if the user toggles before a
  // refetch lands, so `saved` (not `listing.saved`) is the source of truth.
  const handleToggleSave = () => {
    if (!listing) return;
    haptics.tap();
    const wasSaved = saved;
    setSaved(!wasSaved);
    toggleSavedMutation.mutate(
      { ...listing, saved: wasSaved },
      { onError: () => setSaved(wasSaved) },
    );
  };

  useEffect(() => {
    if (listing) setSaved(listing.saved);
  }, [listing]);

  const handleGalleryScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
    setActiveDot(index);
  };

  const scrollToImage = (index: number) => {
    haptics.tap();
    setActiveDot(index);
    galleryRef.current?.scrollTo({ x: index * windowWidth, animated: true });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message="Something went wrong. Please try again." onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon="alert-circle-outline"
          title="This listing is no longer available."
          ctaLabel="Go back"
          onCta={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const sellerInitials = deriveInitials(listing.seller.name);

  const surface = (title: string) => (e: unknown) =>
    Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  const handleMarkSold = () => {
    haptics.impact();
    markSold.mutate(listing.id, { onError: surface("Couldn't mark as sold") });
  };
  const handleRelist = () => {
    haptics.impact();
    relist.mutate(listing.id, { onError: surface("Couldn't relist") });
  };
  const handleDelete = () => {
    haptics.tap();
    Alert.alert('Delete listing?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteListing.mutate(listing.id, {
            onSuccess: () => navigation.goBack(),
            onError: surface("Couldn't delete"),
          }),
      },
    ]);
  };

  // Both bottom-bar actions open the same thread; the offer shortcut just seeds
  // the composer with a template so negotiating happens over chat.
  const openChat = (draftMessage?: string) => {
    haptics.impact();
    navigation.navigate('Chat', {
      listingId: listing.id,
      partnerId: listing.seller.id,
      partner: sellerToContact(listing.seller),
      listingTitle: listing.title,
      listingPrice: listing.price,
      draftMessage,
      // Fresh each tap so re-targeting an already-mounted Chat re-seeds the
      // composer even when the draft string is identical to last time.
      draftNonce: Date.now(),
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top controls */}
      <View style={styles.topBar}>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </PressableScale>
        <View style={styles.topRight}>
          <PressableScale
            style={styles.iconBtn}
            onPress={async () => {
              haptics.tap();
              try {
                await Share.share({ message: `${listing.title} — $${listing.price} on Axis` });
              } catch {
                // Silently ignore — the user cancelling the share sheet isn't an error.
              }
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Share listing"
          >
            <Ionicons name="share-outline" size={20} color={COLORS.text} />
          </PressableScale>
          {/* Save/Report don't apply to your own listing — Share stays either way. */}
          {!isOwnListing && (
            <>
              <PressableScale
                style={styles.iconBtn}
                onPress={handleToggleSave}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
                accessibilityState={{ selected: saved }}
              >
                <AnimatedIconToggle
                  active={saved}
                  activeName="heart"
                  inactiveName="heart-outline"
                  activeColor={COLORS.like}
                  inactiveColor={COLORS.text}
                  size={20}
                />
              </PressableScale>
              <PressableScale
                style={styles.iconBtn}
                onPress={() => {
                  haptics.tap();
                  setReportVisible(true);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel="Report listing"
              >
                <Ionicons name="flag-outline" size={20} color={COLORS.text} />
              </PressableScale>
            </>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Image gallery: swipeable when the listing has photos, otherwise the
            imageColor placeholder is all there is to show. */}
        {listing.imageUrls.length > 0 ? (
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleGalleryScrollEnd}
          >
            {listing.imageUrls.map((uri, i) => (
              <RemoteImage
                key={uri + i}
                uri={uri}
                style={[
                  styles.imagePlaceholder,
                  { width: windowWidth, backgroundColor: listing.imageColor || COLORS.primarySoft },
                ]}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: listing.imageColor || COLORS.primarySoft }]}>
            <Ionicons name="image-outline" size={48} color="rgba(26,26,46,0.3)" />
          </View>
        )}

        {/* Carousel Dots */}
        {listing.imageUrls.length > 1 && (
          <View style={styles.dotsRow}>
            {listing.imageUrls.map((uri, i) => (
              <TouchableOpacity
                key={uri + i}
                onPress={() => scrollToImage(i)}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`View image ${i + 1}`}
                accessibilityState={{ selected: activeDot === i }}
              >
                <View style={[styles.dot, activeDot === i ? styles.dotActive : null]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isOwnListing && (
          <View style={styles.ownerBannerWrap}>
            <View style={styles.ownerBanner}>
              <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.ownerBannerText}>This is your listing.</Text>
              {pendingEditRequest && (
                <View style={styles.pendingChip}>
                  <Text style={styles.pendingChipText}>Edits pending review</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.content}>
          {/* Price + condition */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>${listing.price}</Text>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{listing.condition}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Meta */}
          <Text style={styles.meta}>
            {listing.category} · Posted {listing.postedAgo} · {listing.views} views
          </Text>

          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.divider} />

          {/* Seller Card — disabled (and dimmed) until the full profile has
              loaded, so a tap never silently does nothing mid-fetch. */}
          <PressableScale
            style={[styles.sellerCard, !sellerProfile && styles.sellerCardLoading]}
            onPress={() => {
              haptics.tap();
              if (sellerProfile) navigation.navigate('SellerProfile', { seller: sellerProfile });
            }}
            disabled={!sellerProfile}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`View seller ${listing.seller.name}`}
            accessibilityState={{ disabled: !sellerProfile }}
          >
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInitials}>{sellerInitials}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{listing.seller.name}</Text>
                <View style={styles.sellerVerified}>
                  <View style={[styles.onlineDot, { backgroundColor: listing.seller.dotColor }]} />
                </View>
              </View>
              <Text style={styles.sellerMeta}>{listing.seller.program} · {formatYearOfStudy(listing.seller.year)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </PressableScale>

          <View style={styles.divider} />

          {/* Location */}
          <View style={styles.locationCard}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.locationTitle}>Campus pickup</Text>
              <Text style={styles.locationAddress}>{listing.pickup}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isOwnListing && (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <PressableScale
            style={styles.offerBtn}
            onPress={() =>
              openChat(
                `Hi! I'm interested in your "${listing.title}" ($${listing.price}). Would you consider an offer?`,
              )
            }
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel="Make an offer by message"
          >
            <Text style={styles.offerText}>Make offer</Text>
          </PressableScale>
          <PressableScale
            style={styles.messageBtn}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel="Message seller"
            onPress={() => openChat()}
          >
            <Ionicons name="chatbubble-outline" size={17} color={COLORS.white} />
            <Text style={styles.messageText}>Message</Text>
          </PressableScale>
        </View>
      )}

      {/* Owner Action Bar — replaces the buyer offer/message actions */}
      {isOwnListing && (
        <View style={[styles.ownerActionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <PressableScale
            style={styles.ownerActionBtn}
            scaleTo={0.96}
            onPress={() => {
              haptics.tap();
              navigation.navigate('EditListing', { listingId: listing.id });
            }}
            accessibilityLabel="Edit listing"
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={18} color={COLORS.text} />
            <Text style={styles.ownerActionText}>Edit</Text>
          </PressableScale>
          {listing.status === 'sold' ? (
            <PressableScale
              style={styles.ownerActionBtn}
              scaleTo={0.96}
              onPress={handleRelist}
              accessibilityLabel="Relist"
              accessibilityRole="button"
            >
              <Ionicons name="repeat-outline" size={18} color={COLORS.text} />
              <Text style={styles.ownerActionText}>Relist</Text>
            </PressableScale>
          ) : (
            <PressableScale
              style={styles.ownerActionBtn}
              scaleTo={0.96}
              onPress={handleMarkSold}
              accessibilityLabel="Mark as sold"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.westernGreen} />
              <Text style={[styles.ownerActionText, { color: COLORS.westernGreen }]}>Mark sold</Text>
            </PressableScale>
          )}
          <PressableScale
            style={[styles.ownerActionBtn, styles.ownerDeleteBtn]}
            scaleTo={0.92}
            onPress={handleDelete}
            accessibilityLabel="Delete listing"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </PressableScale>
        </View>
      )}
      <ReportModal
        visible={reportVisible}
        target="listing"
        targetName={listing.title}
        onClose={() => setReportVisible(false)}
        onSubmit={(reason) =>
          createReport.mutateAsync({
            targetType: 'listing',
            targetListingId: listing.id,
            targetUserId: listing.seller.id,
            reason,
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topRight: {
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
    paddingBottom: 20,
  },
  imagePlaceholder: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.stepInactive,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 18,
  },
  content: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  conditionBadge: {
    backgroundColor: COLORS.primaryTint,
    borderRadius: SIZES.borderRadiusSm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  conditionText: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
    lineHeight: 28,
  },
  meta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    padding: 14,
  },
  sellerCardLoading: {
    opacity: 0.6,
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitials: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  sellerName: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  sellerVerified: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sellerMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    padding: 14,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.white,
    ...SHADOWS.floating,
  },
  offerBtn: {
    flex: 1,
    height: 50,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerText: {
    color: COLORS.primary,
    fontSize: 15,
    fontFamily: FONTS.semibold,
  },
  messageBtn: {
    flex: 1,
    height: 50,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...SHADOWS.brand,
  },
  messageText: {
    color: COLORS.white,
    fontSize: 15,
    fontFamily: FONTS.semibold,
  },
  ownerBannerWrap: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  ownerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryTint,
    borderRadius: SIZES.borderRadiusLg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownerBannerText: {
    flex: 1,
    fontSize: SIZES.sm,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  pendingChip: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadiusSm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingChipText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  ownerActionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.white,
    ...SHADOWS.floating,
  },
  ownerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.white,
  },
  ownerActionText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  ownerDeleteBtn: {
    flex: 0,
    width: 50,
    borderColor: COLORS.error,
  },
});
