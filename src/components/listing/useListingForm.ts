import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { haptics } from '../../lib/haptics';
import type { EditablePhoto } from '../../hooks/useListingEdits';

// Shared limits between CreateListing and EditListing.
export const MAX_PHOTOS = 4;
export const DESC_MAX = 300;

const DEFAULT_CATEGORY = 'Electronics';
const DEFAULT_CONDITION = 'Like new';

// Seeds for EditListingScreen's prefill; every field is optional so
// CreateListingScreen can call useListingForm() with nothing and get the
// same defaults the old single-screen form used.
export type ListingFormInitial = {
  title?: string;
  description?: string;
  category?: string;
  condition?: string;
  price?: string;
  isFree?: boolean;
  isTrade?: boolean;
  // Existing remote photos (isLocal: false) prefilled from the listing being
  // edited; CreateListing always starts with an empty array.
  photos?: EditablePhoto[];
};

// The state + validation + photo-picker logic shared by CreateListingScreen's
// wizard and EditListingScreen's single-scroll form (0021's shared form
// core), so neither screen re-implements the Free/Trade exclusivity or the
// camera/library picker flow.
export function useListingForm(initial?: ListingFormInitial) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? DEFAULT_CATEGORY);
  const [condition, setCondition] = useState(initial?.condition ?? DEFAULT_CONDITION);
  const [price, setPrice] = useState(initial?.price ?? '');
  const [isFree, setIsFree] = useState(initial?.isFree ?? false);
  const [isTrade, setIsTrade] = useState(initial?.isTrade ?? false);
  const [photos, setPhotos] = useState<EditablePhoto[]>(initial?.photos ?? []);

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
            const asset = result.assets[0];
            setPhotos(prev =>
              [...prev, { uri: asset.uri, mimeType: asset.mimeType ?? null, isLocal: true }].slice(
                0,
                MAX_PHOTOS,
              ),
            );
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
              [
                ...prev,
                ...result.assets.map(a => ({
                  uri: a.uri,
                  mimeType: a.mimeType ?? null,
                  isLocal: true,
                })),
              ].slice(0, MAX_PHOTOS),
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

  const photosValid = photos.length > 0;
  const detailsValid = title.trim().length > 0;
  const priceValid = price.length > 0 || isFree;
  const canPost = photosValid && detailsValid && priceValid;

  return {
    title,
    setTitle,
    description,
    setDescription,
    category,
    setCategory,
    condition,
    setCondition,
    price,
    setPrice,
    isFree,
    isTrade,
    photos,
    setPhotos,
    handleAddPhoto,
    handleRemovePhoto,
    handleFree,
    handleTrade,
    photosValid,
    detailsValid,
    priceValid,
    canPost,
  };
}
