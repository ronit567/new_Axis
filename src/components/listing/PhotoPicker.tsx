import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
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

// A large, swipeable gallery — matching the buyer-facing ListingDetailScreen
// carousel feel — instead of a row of small thumbnails. Index 0 is always the
// cover and stays the source of truth for persisted order.
export default function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  maxPhotos,
  locked,
  onLockedPress,
}: Props) {
  const [activeDot, setActiveDot] = useState(0);
  const [width, setWidth] = useState(0);
  const galleryRef = useRef<ScrollView>(null);

  const canAdd = !locked && photos.length < maxPhotos;
  // The add tile rides along as an extra carousel page when there's room, so
  // there's exactly one add affordance shared with the empty-state dropzone.
  const pageCount = photos.length + (canAdd ? 1 : 0);

  const handleLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveDot(Math.min(index, pageCount - 1));
  };

  const scrollToIndex = (index: number, animated = true) => {
    const clamped = Math.max(0, Math.min(index, pageCount - 1));
    setActiveDot(clamped);
    galleryRef.current?.scrollTo({ x: clamped * width, animated });
  };

  // Removing a photo (or the add tile sliding off once maxPhotos is no
  // longer hit) can shrink pageCount out from under the current dot —
  // re-clamp and snap the scroll position back in range whenever that
  // happens, e.g. after removing the last photo on the last page.
  useEffect(() => {
    if (!width) return;
    if (activeDot > pageCount - 1) scrollToIndex(pageCount - 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount, width]);

  if (photos.length === 0) {
    return (
      <View>
        <View style={styles.paddedRow}>
          <PressableScale
            style={styles.dropzone}
            onPress={locked ? onLockedPress : onAdd}
            scaleTo={0.98}
            accessibilityLabel="Add up to 4 photos"
            accessibilityRole="button"
          >
            <View style={styles.dropzoneIconTile}>
              <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.dropzoneInfo}>
              <Text style={styles.dropzoneTitle}>Add up to {maxPhotos} photos</Text>
              <Text style={styles.dropzoneHint}>The first photo is your cover</Text>
            </View>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.textMuted} />
          </PressableScale>
        </View>
        {locked && (
          <PressableScale
            style={styles.paddedRow}
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

  return (
    <View>
      <View style={[styles.countRow, styles.paddedRow]}>
        <Text style={styles.countText}>
          {photos.length} of {maxPhotos}
        </Text>
      </View>
      <View style={styles.carouselWrap} onLayout={handleLayout}>
        {width > 0 && (
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {photos.map((photo, index) => (
              <View key={photo.uri + index} style={[styles.page, { width }]}>
                <Image source={{ uri: photo.uri }} style={styles.pageImage} />
                {!locked && (
                  <PressableScale
                    style={styles.removeBtn}
                    onPress={() => onRemove(index)}
                    scaleTo={0.9}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.circleBtn}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.white} />
                    </View>
                  </PressableScale>
                )}
                {index === 0 && (
                  <View style={styles.coverChip}>
                    <Ionicons name="image" size={12} color={COLORS.white} />
                    <Text style={styles.coverChipText}>Cover</Text>
                  </View>
                )}
              </View>
            ))}
            {canAdd && (
              <PressableScale
                style={[styles.page, styles.addPage, { width }]}
                onPress={onAdd}
                scaleTo={0.98}
                accessibilityLabel="Add photo"
                accessibilityRole="button"
              >
                <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                <Text style={styles.addPageLabel}>Add photo</Text>
              </PressableScale>
            )}
          </ScrollView>
        )}
      </View>
      {pageCount > 1 && (
        <View style={[styles.dotsRow, styles.paddedRow]}>
          {Array.from({ length: pageCount }).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollToIndex(i)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`View photo ${i + 1}`}
              accessibilityState={{ selected: activeDot === i }}
            >
              <View style={[styles.dot, activeDot === i ? styles.dotActive : null]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {locked && (
        <PressableScale
          style={styles.paddedRow}
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
  // The carousel/dropzone image itself runs full-bleed edge-to-edge (its
  // parent section escapes the screen's horizontal padding) — this re-adds
  // that padding for the pieces that should stay inset, like the buyer-facing
  // gallery on ListingDetailScreen.
  paddedRow: {
    paddingHorizontal: 20,
  },
  countRow: {
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  countText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  carouselWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceAlt,
  },
  page: {
    aspectRatio: 4 / 3,
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  addPage: {
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryTint,
  },
  addPageLabel: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    marginTop: 8,
    fontFamily: FONTS.medium,
  },
  dropzone: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderStyle: 'dashed',
    borderRadius: SIZES.borderRadiusLg,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dropzoneIconTile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneInfo: {
    flex: 1,
  },
  dropzoneTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  dropzoneHint: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.overlay,
  },
  coverChipText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
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
});
