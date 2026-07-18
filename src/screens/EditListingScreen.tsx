import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { Listing, ListingEditRequest, RootStackParamList } from '../types';
import ErrorState from '../components/ErrorState';
import PressableScale from '../components/PressableScale';
import PrimaryButton from '../components/PrimaryButton';
import PhotoPicker from '../components/listing/PhotoPicker';
import TitleField from '../components/listing/TitleField';
import CategoryDropdown from '../components/listing/CategoryDropdown';
import ConditionSelector from '../components/listing/ConditionSelector';
import DescriptionField from '../components/listing/DescriptionField';
import PriceToggles from '../components/listing/PriceToggles';
import PickupPicker from '../components/listing/PickupPicker';
import { useListingForm, MAX_PHOTOS, DEFAULT_CONDITION } from '../components/listing/useListingForm';
import { haptics } from '../lib/haptics';
import { useListing } from '../hooks/useListings';
import {
  useListingEngagement,
  usePendingEditRequest,
  useUpdateListing,
  useCreateEditRequest,
  resolveListingPhotos,
  photosChanged,
} from '../hooks/useListingEdits';
import type { UpdateListingInput } from '../repositories/ListingRepository';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListing'>;

export default function EditListingScreen({ navigation, route }: Props) {
  const { listingId } = route.params;
  const { data: listing, isLoading, isError, refetch } = useListing(listingId);
  const { data: engaged } = useListingEngagement(listingId);
  const { data: pendingRequest } = usePendingEditRequest(listingId);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !listing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message="Something went wrong. Please try again." onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <EditListingForm
      navigation={navigation}
      listing={listing}
      // Best-effort: while the engagement check is still loading, treat the
      // listing as unengaged (the same posture as a fresh listing with no
      // interest yet) — this is UX-only, guard_engaged_listing_edit (0021) is
      // the real authority and a stale/optimistic read here is caught by the
      // race fallback in handleSave.
      engaged={!!engaged}
      pendingRequest={pendingRequest ?? null}
    />
  );
}

function EditListingForm({
  navigation,
  listing,
  engaged,
  pendingRequest,
}: {
  navigation: Props['navigation'];
  listing: Listing;
  engaged: boolean;
  pendingRequest: ListingEditRequest | null;
}) {
  const { user } = useAuth();
  const updateListing = useUpdateListing();
  const createEditRequest = useCreateEditRequest();
  const [saving, setSaving] = useState(false);

  // Never seed (or submit) the mapper's 'N/A' sentinel for a listing whose DB
  // condition is null — fall back to the same default the picker uses.
  const originalCondition = listing.condition === 'N/A' ? DEFAULT_CONDITION : listing.condition;

  const form = useListingForm({
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: originalCondition,
    price: listing.isFree ? '' : String(listing.price),
    isFree: listing.isFree,
    isTrade: listing.isTrade,
    pickup: listing.pickup,
    photos: listing.imageUrls.map((url, i) => ({
      uri: url,
      mimeType: null,
      isLocal: false,
      thumbUri: listing.thumbUrls[i],
    })),
  });

  // A pending request already covers the scam-vector fields — resubmitting
  // while one is outstanding would just pile up duplicate requests, so those
  // fields stay locked the same as when the listing is actively engaged.
  const scamLocked = engaged || !!pendingRequest;

  const handleLockedPress = () => {
    haptics.tap();
    Alert.alert(
      'Requires review',
      pendingRequest
        ? "You already have changes pending review for this listing's photos, title, category, or condition."
        : "This listing has buyer interest (a save or a message), so changes to its photos, title, category, or condition go through a quick review before they go live.",
    );
  };

  const handleSave = async () => {
    if (saving || !form.detailsValid || !form.priceValid) return;
    if (!user) return;
    haptics.impact();
    setSaving(true);

    const priceNum = form.isFree ? 0 : parseFloat(form.price) || 0;
    const lowRiskPatch: Partial<Omit<UpdateListingInput, 'image_urls' | 'thumb_urls'>> = {};
    if (priceNum !== listing.price) lowRiskPatch.price = priceNum;
    if (form.description.trim() !== listing.description) {
      lowRiskPatch.description = form.description.trim();
    }
    if (form.isFree !== listing.isFree) lowRiskPatch.is_free = form.isFree;
    if (form.isTrade !== listing.isTrade) lowRiskPatch.is_trade = form.isTrade;
    if (form.pickup.trim() !== listing.pickup) lowRiskPatch.pickup = form.pickup.trim();

    const titleChanged = form.title.trim() !== listing.title;
    const categoryChanged = form.category !== listing.category;
    const conditionChanged = form.condition !== originalCondition;
    const photosDidChange = photosChanged(form.photos, listing.imageUrls);
    const scamFieldsChanged = titleChanged || categoryChanged || conditionChanged || photosDidChange;

    let lowRiskSaved = false;

    try {
      // Low-risk fields are never guarded — write them unconditionally first,
      // independent of whatever happens with the scam-vector fields below.
      if (Object.keys(lowRiskPatch).length > 0) {
        await updateListing.mutateAsync({ listingId: listing.id, patch: lowRiskPatch });
        lowRiskSaved = true;
      }

      if (!scamFieldsChanged) {
        navigation.goBack();
        return;
      }

      // Resolved once, up front, so both the direct-update attempt and the
      // race-fallback edit-request reuse the same uploaded URLs instead of
      // uploading the photo set twice.
      const resolvedPhotos = photosDidChange
        ? await resolveListingPhotos(user.id, listing.id, form.photos)
        : undefined;

      const scamPatch: Partial<Omit<UpdateListingInput, 'image_urls' | 'thumb_urls'>> = {};
      if (titleChanged) scamPatch.title = form.title.trim();
      if (categoryChanged) scamPatch.category = form.category;
      if (conditionChanged) scamPatch.condition = form.condition as 'Like new' | 'Good' | 'Fair';

      if (!scamLocked) {
        try {
          await updateListing.mutateAsync({
            listingId: listing.id,
            patch: {
              ...scamPatch,
              ...(resolvedPhotos
                ? { image_urls: resolvedPhotos.imageUrls, thumb_urls: resolvedPhotos.thumbUrls }
                : {}),
            },
          });
          navigation.goBack();
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Race: the listing picked up engagement between our (UX-only)
          // check and this write landing — the server-side guard is the real
          // authority and just rejected it. Fall through to filing a review
          // request instead of surfacing a dead-end error.
          if (!message.includes('listing_edit_requires_review')) throw error;
        }
      }

      await createEditRequest.mutateAsync({
        listingId: listing.id,
        title: titleChanged ? form.title.trim() : undefined,
        category: categoryChanged ? form.category : undefined,
        condition: conditionChanged ? form.condition : undefined,
        imageUrls: resolvedPhotos?.imageUrls,
      });
      Alert.alert(
        'Submitted for review',
        "This listing's photo, title, category, or condition changes are pending review before they go live.",
      );
      navigation.goBack();
    } catch (error) {
      if (lowRiskSaved) {
        Alert.alert(
          'Some changes saved',
          `Your price, description, and pickup changes were saved, but the changes that need review couldn't be submitted. Please try again.${
            error instanceof Error ? ` ${error.message}` : ''
          }`,
        );
      } else {
        Alert.alert(
          "Couldn't save changes",
          error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.detailsValid && form.priceValid && !saving;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <PressableScale
          style={styles.headerIconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          scaleTo={0.9}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Edit listing</Text>
        <View style={styles.headerSpacer} />
      </View>

      {pendingRequest && (
        <View style={styles.pendingBannerWrap}>
          <View style={styles.pendingBanner}>
            <View style={styles.pendingIconTile}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.pendingBannerInfo}>
              <Text style={styles.pendingBannerTitle}>Pending review</Text>
              <Text style={styles.pendingBannerText}>
                Changes to photos, title, category, or condition are pending review.
              </Text>
            </View>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoSection}>
            <Text style={[styles.sectionHeading, styles.photoSectionHeading]}>Photos</Text>
            <PhotoPicker
              photos={form.photos}
              onAdd={form.handleAddPhoto}
              onRemove={form.handleRemovePhoto}
              maxPhotos={MAX_PHOTOS}
              locked={scamLocked}
              onLockedPress={handleLockedPress}
            />
          </View>

          <View style={[styles.section, styles.sectionDivider]}>
            <Text style={styles.sectionHeading}>Listing details</Text>

            <Text style={styles.fieldLabel}>Title</Text>
            <View style={styles.field}>
              <TitleField
                value={form.title}
                onChange={form.setTitle}
                locked={scamLocked}
                onLockedPress={handleLockedPress}
              />
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.field}>
              <CategoryDropdown
                value={form.category}
                onChange={form.setCategory}
                locked={scamLocked}
                onLockedPress={handleLockedPress}
              />
            </View>

            <Text style={styles.fieldLabel}>Condition</Text>
            <ConditionSelector
              value={form.condition}
              onChange={form.setCondition}
              locked={scamLocked}
              onLockedPress={handleLockedPress}
            />
          </View>

          <View style={[styles.section, styles.sectionDivider]}>
            <Text style={styles.sectionHeading}>Description &amp; price</Text>

            <Text style={styles.fieldLabel}>Description</Text>
            <View style={styles.field}>
              <DescriptionField value={form.description} onChange={form.setDescription} />
            </View>

            <Text style={styles.fieldLabel}>Price</Text>
            <View style={styles.field}>
              <PriceToggles
                price={form.price}
                onPriceChange={form.setPrice}
                isFree={form.isFree}
                onToggleFree={form.handleFree}
                isTrade={form.isTrade}
                onToggleTrade={form.handleTrade}
              />
            </View>

            <Text style={styles.fieldLabel}>Pickup spot</Text>
            <PickupPicker value={form.pickup} onChange={form.setPickup} />
          </View>

          <PrimaryButton
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  pendingBannerWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadiusLg,
    padding: 14,
    ...SHADOWS.card,
  },
  pendingIconTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerInfo: {
    flex: 1,
  },
  pendingBannerTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    marginBottom: 2,
  },
  pendingBannerText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  // Escapes the ScrollView's horizontal padding so the photo carousel runs
  // full-bleed edge-to-edge; the heading re-adds it just for itself.
  photoSection: {
    marginHorizontal: -20,
    marginBottom: 24,
  },
  photoSectionHeading: {
    paddingHorizontal: 20,
  },
  sectionDivider: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  sectionHeading: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.semibold,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  field: {
    marginBottom: 20,
  },
  saveBtn: {
    marginTop: 4,
  },
});
