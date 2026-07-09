import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';
import PhotoPicker from '../components/listing/PhotoPicker';
import TitleField from '../components/listing/TitleField';
import CategoryDropdown from '../components/listing/CategoryDropdown';
import ConditionSelector from '../components/listing/ConditionSelector';
import DescriptionField from '../components/listing/DescriptionField';
import PriceToggles from '../components/listing/PriceToggles';
import PickupPicker from '../components/listing/PickupPicker';
import { useListingForm, MAX_PHOTOS } from '../components/listing/useListingForm';
import { haptics } from '../lib/haptics';
import { useCreateListing } from '../hooks/useListings';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateListing'>;

export default function CreateListingScreen({ navigation }: Props) {
  const form = useListingForm();
  const createListing = useCreateListing();

  const handlePost = async () => {
    if (!form.canPost || createListing.isPending) return;
    haptics.impact();
    try {
      await createListing.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.isFree ? 0 : parseFloat(form.price) || 0,
        is_free: form.isFree,
        is_trade: form.isTrade,
        condition: form.condition as 'Like new' | 'Good' | 'Fair',
        category: form.category,
        pickup: form.pickup.trim(),
        // Every photo on this screen is freshly picked (isLocal), never a
        // prefilled remote one — strip down to the plain LocalPhoto shape
        // useCreateListing expects.
        photos: form.photos.map(p => ({ uri: p.uri, mimeType: p.mimeType })),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Couldn't post listing",
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          scaleTo={0.9}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>New listing</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            <Text style={styles.cardHint}>
              Add up to {MAX_PHOTOS} — the first photo is your cover.
            </Text>
            <PhotoPicker
              photos={form.photos}
              onAdd={form.handleAddPhoto}
              onRemove={form.handleRemovePhoto}
              maxPhotos={MAX_PHOTOS}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Listing details</Text>

            <Text style={styles.fieldLabel}>Title</Text>
            <View style={styles.field}>
              <TitleField value={form.title} onChange={form.setTitle} />
            </View>

            <Text style={styles.fieldLabel}>Description</Text>
            <View style={styles.field}>
              <DescriptionField value={form.description} onChange={form.setDescription} />
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <CategoryDropdown value={form.category} onChange={form.setCategory} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Price &amp; pickup</Text>

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

            <Text style={styles.fieldLabel}>Condition</Text>
            <View style={styles.field}>
              <ConditionSelector value={form.condition} onChange={form.setCondition} />
            </View>

            <Text style={styles.fieldLabel}>Pickup spot</Text>
            <PickupPicker value={form.pickup} onChange={form.setPickup} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <PressableScale
          style={[styles.postBtn, !form.canPost ? styles.postBtnDisabled : null]}
          onPress={handlePost}
          disabled={!form.canPost || createListing.isPending}
          accessibilityLabel="Post listing"
          accessibilityRole="button"
          accessibilityState={{ disabled: !form.canPost || createListing.isPending }}
        >
          <Text style={styles.postBtnText}>
            {createListing.isPending ? 'Posting…' : 'Post listing'}
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EDEAF6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
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
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadiusLg,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  cardTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  cardHint: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: 12,
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.borderRadius,
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.brand,
  },
  postBtnDisabled: {
    backgroundColor: '#C4B2E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  postBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
  },
});
