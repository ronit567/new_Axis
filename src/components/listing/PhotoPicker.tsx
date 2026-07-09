import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import PressableScale from '../PressableScale';
import LockedHint from './LockedHint';
import type { EditablePhoto } from '../../hooks/useListingEdits';

type Props = {
  photos: EditablePhoto[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  maxPhotos: number;
  // EditListingScreen: photos are a scam-vector field — once the listing is
  // engaged, changing them requires review instead of a direct save. Locked
  // hides add/remove and swaps in a "Requires review" affordance.
  locked?: boolean;
  onLockedPress?: () => void;
};

export default function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  maxPhotos,
  locked,
  onLockedPress,
}: Props) {
  return (
    <View>
      <View style={styles.photosRow}>
        {photos.map((photo, index) => (
          <View key={photo.uri + index} style={styles.photoThumb}>
            <Image source={{ uri: photo.uri }} style={styles.photoThumbImage} />
            {!locked && (
              <PressableScale
                style={styles.photoRemoveBtn}
                onPress={() => onRemove(index)}
                scaleTo={0.9}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                accessibilityLabel={`Remove photo ${index + 1}`}
                accessibilityRole="button"
              >
                <View style={styles.photoRemoveInner}>
                  <Ionicons name="close" size={13} color={COLORS.white} />
                </View>
              </PressableScale>
            )}
          </View>
        ))}
        {!locked && photos.length < maxPhotos && (
          <PressableScale
            style={styles.addPhotoBox}
            onPress={onAdd}
            scaleTo={0.94}
            accessibilityLabel="Add photo"
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={26} color={COLORS.primary} />
            <Text style={styles.addPhotoLabel}>Add photo</Text>
          </PressableScale>
        )}
      </View>
      {locked && (
        <PressableScale
          onPress={onLockedPress}
          scaleTo={0.98}
          accessibilityLabel="Photos require review to change"
          accessibilityRole="button"
        >
          <LockedHint label="Photos require review to change" />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
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
});
