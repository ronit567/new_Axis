import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { FONTS } from '../constants/theme';
import RemoteImage from './RemoteImage';
import PressableScale from './PressableScale';

type Props = {
  visible: boolean;
  imageUrls: string[];
  initialIndex: number;
  onClose: () => void;
};

// Fullscreen photo viewer opened from the listing hero. Deliberately black in
// both themes (a photo viewer isn't chrome, it's a lightbox), and leans on
// native ScrollView zoom rather than a gesture library since pinch-to-zoom on
// iOS is free once the content is inside a ScrollView with min/maxZoomScale.
export default function ImageViewerModal({ visible, imageUrls, initialIndex, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const pagerRef = useRef<ScrollView>(null);

  // Re-sync to the requested page whenever the viewer reopens (possibly at a
  // different index than last time) — contentOffset alone only applies on
  // first mount, so a reopen at a new index needs an explicit scrollTo too.
  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      pagerRef.current?.scrollTo({ x: initialIndex * width, animated: false });
    }
  }, [visible, initialIndex, width]);

  if (imageUrls.length === 0) return null;

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar style="light" />
      <View style={styles.container}>
        <ScrollView
          key={initialIndex}
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {imageUrls.map((uri, i) => (
            <ScrollView
              key={uri + i}
              style={{ width }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              bouncesZoom
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
              contentContainerStyle={[styles.page, { width }]}
            >
              <RemoteImage
                uri={uri}
                contentFit="contain"
                transition={150}
                style={{ width, height: '100%' }}
              />
            </ScrollView>
          ))}
        </ScrollView>

        <View style={[styles.topOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
          <View style={styles.topRow}>
            <PressableScale
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={8}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
            >
              <Ionicons name="close" size={22} color="#FFF" />
            </PressableScale>
            {imageUrls.length > 1 && (
              <Text style={styles.counter}>
                {activeIndex + 1} of {imageUrls.length}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // A photo viewer is deliberately black in both themes — not a theme color.
    backgroundColor: '#000',
  },
  page: {
    height: '100%',
    justifyContent: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    flex: 1,
    marginRight: 38,
    textAlign: 'center',
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
});
