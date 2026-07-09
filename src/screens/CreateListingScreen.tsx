import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../types';
import StepHeader from '../components/StepHeader';
import PressableScale from '../components/PressableScale';
import PhotoPicker from '../components/listing/PhotoPicker';
import TitleField from '../components/listing/TitleField';
import CategoryDropdown from '../components/listing/CategoryDropdown';
import ConditionSelector from '../components/listing/ConditionSelector';
import DescriptionField from '../components/listing/DescriptionField';
import PriceToggles from '../components/listing/PriceToggles';
import { useListingForm, MAX_PHOTOS } from '../components/listing/useListingForm';
import { haptics } from '../lib/haptics';
import { useCreateListing } from '../hooks/useListings';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateListing'>;

const TOTAL_STEPS = 3;

export default function CreateListingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const form = useListingForm();
  const createListing = useCreateListing();

  const handleBack = () => {
    haptics.tap();
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep(s => s - 1);
    }
  };

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
        // No pickup-location input on this screen yet — left blank until one exists.
        pickup: '',
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

  const handleNext = () => {
    if (step === 0) {
      if (!form.photosValid) return;
      haptics.tap();
      setStep(1);
    } else if (step === 1) {
      if (!form.detailsValid) return;
      haptics.tap();
      setStep(2);
    } else {
      handlePost();
    }
  };

  const canAdvance =
    step === 0 ? form.photosValid : step === 1 ? form.detailsValid : form.canPost;

  const footerLabel =
    step === 0 ? 'Next' : step === 1 ? 'Next' : createListing.isPending ? 'Posting…' : 'Post listing';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <StepHeader currentStep={step + 1} totalSteps={TOTAL_STEPS} onBack={handleBack} />
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
          {step === 0 && (
            <>
              <Text style={styles.stepHeading}>Add photos</Text>
              <Text style={styles.stepSubheading}>
                Add up to {MAX_PHOTOS} — the first photo is your cover.
              </Text>
              <PhotoPicker
                photos={form.photos}
                onAdd={form.handleAddPhoto}
                onRemove={form.handleRemovePhoto}
                maxPhotos={MAX_PHOTOS}
              />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.stepHeading}>Tell us about it</Text>

              <Text style={styles.sectionHeading}>Title</Text>
              <View style={styles.field}>
                <TitleField value={form.title} onChange={form.setTitle} />
              </View>

              <Text style={styles.sectionHeading}>Category</Text>
              <View style={styles.field}>
                <CategoryDropdown value={form.category} onChange={form.setCategory} />
              </View>

              <Text style={styles.sectionHeading}>Condition</Text>
              <View style={styles.field}>
                <ConditionSelector value={form.condition} onChange={form.setCondition} />
              </View>

              <Text style={styles.sectionHeading}>Description</Text>
              <DescriptionField value={form.description} onChange={form.setDescription} />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepHeading}>Set your price</Text>

              <Text style={styles.sectionHeading}>Price</Text>
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

              <Text style={styles.sectionHeading}>Review</Text>
              <View style={styles.summaryCard}>
                {form.photos[0] ? (
                  <Image source={{ uri: form.photos[0].uri }} style={styles.summaryThumb} />
                ) : (
                  <View style={[styles.summaryThumb, styles.summaryThumbEmpty]} />
                )}
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryTitle} numberOfLines={1}>
                    {form.title || 'Untitled listing'}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    {form.category} · {form.condition}
                  </Text>
                  <Text style={styles.summaryPrice}>
                    {form.isFree ? 'Free' : form.isTrade ? 'Trade' : `$${form.price || '0'}`}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <PressableScale
          style={[styles.postBtn, !canAdvance ? styles.postBtnDisabled : null]}
          onPress={handleNext}
          disabled={!canAdvance || createListing.isPending}
          accessibilityLabel={footerLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdvance || createListing.isPending }}
        >
          <Text style={styles.postBtnText}>{footerLabel}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  stepHeading: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  stepSubheading: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    marginBottom: 10,
  },
  field: {
    marginBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: SIZES.borderRadiusLg,
    padding: 14,
  },
  summaryThumb: {
    width: 64,
    height: 64,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.primarySoft,
  },
  summaryThumbEmpty: {
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  summaryInfo: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  summaryMeta: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
  },
  summaryPrice: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
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
