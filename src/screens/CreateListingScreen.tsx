import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateListing'>;

const CATEGORIES = [
  'Electronics',
  'Textbooks',
  'Furniture',
  'Clothing',
  'Sports',
  'Other',
];

const CONDITIONS = ['Like new', 'Good', 'Fair'];

const DESC_MAX = 300;

export default function CreateListingScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [isTrade, setIsTrade] = useState(false);
  const [condition, setCondition] = useState('Like new');

  const canPost = title.trim().length > 0 && (price.length > 0 || isFree);

  const handleFree = () => {
    setIsFree(!isFree);
    if (!isFree) {
      setPrice('');
      setIsTrade(false);
    }
  };

  const handleTrade = () => {
    setIsTrade(!isTrade);
    if (!isTrade) setIsFree(false);
  };

  const handlePost = () => {
    if (canPost) navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New listing</Text>
        <TouchableOpacity
          onPress={handlePost}
          style={styles.headerBtn}
          disabled={!canPost}
        >
          <Text style={[styles.postText, canPost ? styles.postTextActive : null]}>
            Post
          </Text>
        </TouchableOpacity>
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
          <View style={styles.photosRow}>
            <TouchableOpacity style={styles.addPhotoBox} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={26} color={COLORS.textMuted} />
              <Text style={styles.addPhotoLabel}>Add photo</Text>
            </TouchableOpacity>
            {[1, 2, 3].map(i => (
              <View key={i} style={styles.emptyPhotoBox} />
            ))}
          </View>

          {/* Title */}
          <Text style={styles.fieldLabel}>Title</Text>
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
            <Text style={styles.fieldLabel}>Description</Text>
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
          <Text style={styles.fieldLabel}>Category</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownText}>{category}</Text>
            <Ionicons
              name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.dropdownList}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.dropdownItem,
                    c === category ? styles.dropdownItemActive : null,
                  ]}
                  onPress={() => {
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
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Price */}
          <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Price</Text>
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
            <TouchableOpacity
              style={[styles.toggleBtn, isFree ? styles.toggleBtnActive : null]}
              onPress={handleFree}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, isFree ? styles.toggleTextActive : null]}>
                Free
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, isTrade ? styles.toggleBtnActive : null]}
              onPress={handleTrade}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, isTrade ? styles.toggleTextActive : null]}>
                Trade
              </Text>
            </TouchableOpacity>
          </View>

          {/* Condition */}
          <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Condition</Text>
          <View style={styles.conditionRow}>
            {CONDITIONS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.condBtn, condition === c ? styles.condBtnActive : null]}
                onPress={() => setCondition(c)}
                activeOpacity={0.8}
              >
                <Text style={[styles.condText, condition === c ? styles.condTextActive : null]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Post button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.postBtn, !canPost ? styles.postBtnDisabled : null]}
          onPress={handlePost}
          activeOpacity={0.85}
          disabled={!canPost}
        >
          <Text style={styles.postBtnText}>Post listing</Text>
        </TouchableOpacity>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  postText: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  postTextActive: {
    color: COLORS.primary,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  addPhotoBox: {
    width: 80,
    height: 80,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  addPhotoLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyPhotoBox: {
    width: 80,
    height: 80,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.background,
  },
  fieldLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  descHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  charCount: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  descInput: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 110,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
    marginBottom: 4,
  },
  dropdownText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    backgroundColor: COLORS.white,
    marginBottom: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemActive: {
    backgroundColor: '#F3EEFF',
  },
  dropdownItemText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  priceInputDisabled: {
    backgroundColor: COLORS.background,
  },
  priceDollar: {
    fontSize: SIZES.base,
    color: COLORS.text,
    marginRight: 4,
    fontWeight: '500',
  },
  priceInput: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  toggleBtn: {
    paddingHorizontal: 18,
    height: SIZES.inputHeight,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  toggleBtnActive: {
    backgroundColor: '#F3EEFF',
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  condBtn: {
    flex: 1,
    height: 42,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  condBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  condText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  condTextActive: {
    color: COLORS.white,
    fontWeight: '700',
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
  },
  postBtnDisabled: {
    backgroundColor: '#C4B2E0',
  },
  postBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
  },
});
