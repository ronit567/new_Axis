import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { haptics } from '../../lib/haptics';
import type { EditablePhoto } from '../../hooks/useListingEdits';

// Shared limits between CreateListing and EditListing.
export const MAX_PHOTOS = 4;
export const DESC_MAX = 300;

const DEFAULT_CATEGORY = 'Electronics';
// Exported so EditListingScreen can map the mapper's 'N/A' fallback (an old
// listing with no DB condition) to the same default this form seeds with,
// rather than ever seeding/submitting the sentinel itself.
export const DEFAULT_CONDITION = 'Like new';

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
  pickup?: string;
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
  const [pickup, setPickup] = useState(initial?.pickup ?? '');
  const [photos, setPhotos] = useState<EditablePhoto[]>(initial?.photos ?? []);
  // Cropping is opt-in from the preview carousel rather than a forced step on
  // every picked photo — cropIndex tracks which photo (if any) is currently
  // being cropped, and the modal always receives that photo's untouched
  // `original`, never the already-cropped `uri`, so re-crops never compound.
  const [cropIndex, setCropIndex] = useState<number | null>(null);

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
          });
          if (!result.canceled) {
            const asset = result.assets[0];
            setPhotos(prev =>
              [
                ...prev,
                {
                  uri: asset.uri,
                  mimeType: asset.mimeType ?? null,
                  width: asset.width,
                  height: asset.height,
                  isLocal: true,
                  original: { uri: asset.uri, width: asset.width, height: asset.height },
                },
              ].slice(0, MAX_PHOTOS),
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
                  width: a.width,
                  height: a.height,
                  isLocal: true,
                  original: { uri: a.uri, width: a.width, height: a.height },
                })),
              ].slice(0, MAX_PHOTOS),
            );
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Opens the crop modal for an already-added photo, sourced from the
  // carousel's crop button.
  const handleCropPhoto = (index: number) => {
    haptics.tap();
    setCropIndex(index);
  };

  const handleCropDone = (cropped: {
    uri: string;
    mimeType: string;
    width: number;
    height: number;
  }) => {
    // `original` is left untouched so a later re-crop still starts from the
    // uncropped source instead of compounding on the last crop's output.
    // width/height DO move to the cropped values — the upload pass resizes
    // off them, so leaving the pre-crop dimensions would mis-scale the file.
    setPhotos(prev =>
      prev.map((p, i) =>
        i === cropIndex
          ? {
              ...p,
              uri: cropped.uri,
              mimeType: cropped.mimeType,
              width: cropped.width,
              height: cropped.height,
            }
          : p,
      ),
    );
    setCropIndex(null);
  };

  const handleCropCancel = () => setCropIndex(null);

  const cropPhoto = cropIndex !== null ? photos[cropIndex]?.original ?? null : null;

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
    pickup,
    setPickup,
    photos,
    setPhotos,
    cropPhoto,
    handleAddPhoto,
    handleCropPhoto,
    handleCropDone,
    handleCropCancel,
    handleRemovePhoto,
    handleFree,
    handleTrade,
    photosValid,
    detailsValid,
    priceValid,
    canPost,
  };
}
