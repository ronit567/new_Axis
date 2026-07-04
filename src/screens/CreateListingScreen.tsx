import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../types';
import { LISTING_CATEGORIES } from '../constants/categories';
import RotatingChevron from '../components/RotatingChevron';
import PressableScale from '../components/PressableScale';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateListing'>;

const CATEGORIES = LISTING_CATEGORIES;

const CONDITIONS = ['Like new', 'Good', 'Fair'];

const DESC_MAX = 300;
const MAX_PHOTOS = 4;

export default function CreateListingScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [isTrade, setIsTrade] = useState(false);
  const [condition, setCondition] = useState('Like new');
  const [photos, setPhotos] = useState<string[]>([]);

  const canPost = title.trim().length > 0 && (price.length > 0 || isFree);

  const handleAddPhoto = () => {
    Alert.alert('Add photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Camera access is needed to take photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled) {
            setPhotos(prev => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
          }
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Photo library access is needed to pick photos.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - photos.length,
          });
          if (!result.canceled) {
            setPhotos(prev =>
              [...prev, ...result.assets.map(a => a.uri)].slice(0, MAX_PHOTOS)
            );
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFree = () => {
    haptics.tap();
    setIsFree(!isFree);
    if (!isFree) {
      setPrice('');
      setIsTrade(false);
    }
  };

  const handleTrade = () => {
    haptics.tap();
    setIsTrade(!isTrade);
    if (!isTrade) setIsFree(false);
  };

  const handlePost = () => {
    if (canPost) {
      haptics.impact();
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {/* Header */}
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
        <PressableScale
          onPress={handlePost}
          style={styles.headerPostBtn}
          scaleTo={0.9}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={!canPost}
          accessibilityLabel="Post listing"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPost }}
        >
          <Text style={[styles.postText, canPost ? styles.postTextActive : null]}>
            Post
          </Text>
        </PressableScale>
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
          {/* Photos */}
          <Text style={styles.sectionHeading}>Photos</Text>
          <View style={styles.photosRow}>
            {photos.map((uri, index) => (
              <View key={uri + index} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImage} />
                <PressableScale
                  style={styles.photoRemoveBtn}
                  onPress={() => handleRemovePhoto(index)}
                  scaleTo={0.9}
                  hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  accessibilityRole="button"
                >
                  <View style={styles.photoRemoveInner}>
                    <Ionicons name="close" size={13} color={COLORS.white} />
                  </View>
                </PressableScale>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <PressableScale
                style={styles.addPhotoBox}
                onPress={handleAddPhoto}
                scaleTo={0.94}
                accessibilityLabel="Add photo"
                accessibilityRole="button"
              >
                <Ionicons name="camera-outline" size={26} color={COLORS.primary} />
                <Text style={styles.addPhotoLabel}>Add photo</Text>
              </PressableScale>
            )}
          </View>

          {/* Title */}
          <Text style={styles.sectionHeading}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What are you selling?"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="next"
          />

          {/* Description */}
          <View style={styles.descHeader}>
            <Text style={styles.sectionHeading}>Description</Text>
            <Text style={styles.charCount}>{description.length}/{DESC_MAX}</Text>
          </View>
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={t => setDescription(t.slice(0, DESC_MAX))}
            placeholder={'Barely used, comes with original box and charger. No scratches, screen protector on since day one. Cash or e-transfer.'}
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Category */}
          <Text style={styles.sectionHeading}>Category</Text>
          <PressableScale
            style={styles.dropdown}
            onPress={() => {
              haptics.tap();
              setShowCategoryPicker(!showCategoryPicker);
            }}
            scaleTo={0.98}
          >
            <Text style={styles.dropdownText}>{category}</Text>
            <RotatingChevron open={showCategoryPicker} size={16} color={COLORS.textMuted} />
          </PressableScale>
          {showCategoryPicker && (
            <View style={styles.dropdownList}>
              {CATEGORIES.map(c => (
                <PressableScale
                  key={c}
                  style={[
                    styles.dropdownItem,
                    c === category ? styles.dropdownItemActive : null,
                  ]}
                  scaleTo={0.98}
                  onPress={() => {
                    haptics.tap();
                    setCategory(c);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      c === category ? styles.dropdownItemTextActive : null,
                    ]}
                  >
                    {c}
                  </Text>
                  {c === category && (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  )}
                </PressableScale>
              ))}
            </View>
          )}

          {/* Price */}
          <Text style={styles.sectionHeading}>Price</Text>
          <View style={styles.priceRow}>
            <View style={[styles.priceInputWrap, isFree ? styles.priceInputDisabled : null]}>
              <Text style={styles.priceDollar}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                editable={!isFree}
              />
            </View>
            <PressableScale
              style={[styles.toggleBtn, isFree ? styles.toggleBtnActive : null]}
              onPress={handleFree}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityState={{ selected: isFree }}
            >
              <Text style={[styles.toggleText, isFree ? styles.toggleTextActive : null]}>
                Free
              </Text>
            </PressableScale>
            <PressableScale
              style={[styles.toggleBtn, isTrade ? styles.toggleBtnActive : null]}
              onPress={handleTrade}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityState={{ selected: isTrade }}
            >
              <Text style={[styles.toggleText, isTrade ? styles.toggleTextActive : null]}>
                Trade
              </Text>
            </PressableScale>
          </View>

          {/* Condition */}
          <Text style={styles.sectionHeading}>Condition</Text>
          <View style={styles.conditionRow}>
            {CONDITIONS.map(c => (
              <PressableScale
                key={c}
                style={[styles.condBtn, condition === c ? styles.condBtnActive : null]}
                onPress={() => {
                  haptics.tap();
                  setCondition(c);
                }}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: condition === c }}
              >
                <Text style={[styles.condText, condition === c ? styles.condTextActive : null]}>
                  {c}
                </Text>
              </PressableScale>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Post button */}
      <View style={styles.footer}>
        <PressableScale
          style={[styles.postBtn, !canPost ? styles.postBtnDisabled : null]}
          onPress={handlePost}
          disabled={!canPost}
          accessibilityLabel="Post listing"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPost }}
        >
          <Text style={styles.postBtnText}>Post listing</Text>
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
  headerPostBtn: {
    minWidth: 44,
    height: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  postText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.textMuted,
  },
  postTextActive: {
    color: COLORS.primary,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 140,
  },
  sectionHeading: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    marginBottom: 10,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  addPhotoBox: {
    width: 80,
    height: 80,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryTint,
  },
  addPhotoLabel: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 4,
    fontFamily: FONTS.medium,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  photoRemoveInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  charCount: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 24,
  },
  descInput: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 110,
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    marginBottom: 8,
  },
  dropdownText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.white,
    marginBottom: 24,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.primaryTint,
  },
  dropdownItemText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  priceInputDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
  priceDollar: {
    fontSize: SIZES.base,
    color: COLORS.text,
    marginRight: 4,
    fontFamily: FONTS.semibold,
  },
  priceInput: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  toggleBtn: {
    paddingHorizontal: 18,
    height: SIZES.inputHeight,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  condBtn: {
    flex: 1,
    height: 46,
    borderRadius: SIZES.borderRadiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  condBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.brand,
  },
  condText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  condTextActive: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
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
