import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { COLORS, FONTS, SIZES } from '../../constants/theme';
import PressableScale from '../PressableScale';
import { haptics } from '../../lib/haptics';

export type CropPhoto = { uri: string; width: number; height: number };

type Props = {
  visible: boolean;
  photo: CropPhoto | null;
  onDone: (cropped: { uri: string; mimeType: string; width: number; height: number }) => void;
  onCancel: () => void;
};

// A freeform trim step, opt-in from the photo carousel rather than a forced
// step on every picked photo: this crops the PHOTO ITSELF — what a buyer sees
// when they open the image fullscreen — not the preview tile (previews
// center-crop automatically, so there is no fixed aspect ratio here). The
// photo is shown fit-to-screen with a draggable/resizable crop rectangle over
// it, iOS-Photos style, and Done bakes exactly that region into a new JPEG.
// Canceling simply leaves the photo as it was. Deliberately black in both
// themes like ImageViewerModal — a crop surface is a lightbox, not chrome.

type Rect = { x: number; y: number; w: number; h: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';

// iOS-Photos corner brackets: a 44pt touch target with a ~22pt L of 3pt strokes.
const HANDLE = 44;
const BRACKET = 22;
const STROKE = 3;
// Never let a crop rect collapse below this (or invert) on a corner drag.
const MIN_RECT = 48;

export default function PhotoCropModal({ visible, photo, onDone, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  // The workspace is the flexible padded area between header and bottom bar,
  // measured on layout so the fit math can center the photo in it.
  const [work, setWork] = useState<{ w: number; h: number } | null>(null);

  // Contain the photo in the workspace: fitScale never upscales past the frame.
  const fitScale =
    photo && work ? Math.min(work.w / photo.width, work.h / photo.height) : 1;
  const dispW = photo && work ? photo.width * fitScale : 0;
  const dispH = photo && work ? photo.height * fitScale : 0;
  const imgLeft = work ? (work.w - dispW) / 2 : 0;
  const imgTop = work ? (work.h - dispH) / 2 : 0;

  // Crop rect in DISPLAYED-image coordinates (relative to the image top-left).
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  // Mirrors of rect + display bounds so the PanResponders (created once) always
  // read live values instead of stale closures. startRect snapshots the rect on
  // gesture grant so moves apply dx/dy against a fixed origin.
  const rectRef = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const boundsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const startRef = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });

  // Reset the rect to the full image whenever the photo or the workspace size
  // changes — a fresh photo always starts uncropped.
  useEffect(() => {
    if (!photo || !work) return;
    boundsRef.current = { w: dispW, h: dispH };
    const full = { x: 0, y: 0, w: dispW, h: dispH };
    rectRef.current = full;
    setRect(full);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.uri, work?.w, work?.h]);

  const responders = useMemo(() => {
    const commit = (r: Rect) => {
      rectRef.current = r;
      setRect(r);
    };
    const grant = () => {
      startRef.current = { ...rectRef.current };
    };

    // Dragging a corner moves that corner while its opposite edges stay
    // anchored; clamps keep the rect inside [0,disp] and no smaller than
    // MIN_RECT, which also prevents inverting across the anchor.
    const makeCorner = (corner: Corner) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: grant,
        onPanResponderMove: (_e, g) => {
          const s = startRef.current;
          const { w: bw, h: bh } = boundsRef.current;
          let x = s.x;
          let y = s.y;
          let w = s.w;
          let h = s.h;
          if (corner === 'tl') {
            const right = s.x + s.w;
            const bottom = s.y + s.h;
            const nx = Math.max(0, Math.min(s.x + g.dx, right - MIN_RECT));
            const ny = Math.max(0, Math.min(s.y + g.dy, bottom - MIN_RECT));
            x = nx;
            y = ny;
            w = right - nx;
            h = bottom - ny;
          } else if (corner === 'tr') {
            const left = s.x;
            const bottom = s.y + s.h;
            const nr = Math.min(bw, Math.max(s.x + s.w + g.dx, left + MIN_RECT));
            const ny = Math.max(0, Math.min(s.y + g.dy, bottom - MIN_RECT));
            x = left;
            y = ny;
            w = nr - left;
            h = bottom - ny;
          } else if (corner === 'bl') {
            const right = s.x + s.w;
            const top = s.y;
            const nx = Math.max(0, Math.min(s.x + g.dx, right - MIN_RECT));
            const nb = Math.min(bh, Math.max(s.y + s.h + g.dy, top + MIN_RECT));
            x = nx;
            y = top;
            w = right - nx;
            h = nb - top;
          } else {
            const left = s.x;
            const top = s.y;
            const nr = Math.min(bw, Math.max(s.x + s.w + g.dx, left + MIN_RECT));
            const nb = Math.min(bh, Math.max(s.y + s.h + g.dy, top + MIN_RECT));
            x = left;
            y = top;
            w = nr - left;
            h = nb - top;
          }
          commit({ x, y, w, h });
        },
      });

    // Dragging inside the rect translates it without resizing, clamped so it
    // never leaves the displayed image.
    const body = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: grant,
      onPanResponderMove: (_e, g) => {
        const s = startRef.current;
        const { w: bw, h: bh } = boundsRef.current;
        const nx = Math.max(0, Math.min(s.x + g.dx, bw - s.w));
        const ny = Math.max(0, Math.min(s.y + g.dy, bh - s.h));
        commit({ x: nx, y: ny, w: s.w, h: s.h });
      },
    });

    return {
      tl: makeCorner('tl'),
      tr: makeCorner('tr'),
      bl: makeCorner('bl'),
      br: makeCorner('br'),
      body,
    };
  }, []);

  const onWorkLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setWork({ w: width, h: height });
  };

  const handleReset = () => {
    haptics.tap();
    const { w, h } = boundsRef.current;
    const full = { x: 0, y: 0, w, h };
    rectRef.current = full;
    setRect(full);
  };

  const handleCancel = () => {
    if (busy) return;
    haptics.tap();
    onCancel();
  };

  const handleDone = async () => {
    if (busy || !photo) return;
    haptics.tap();
    const r = rectRef.current;

    // Rect still spans the whole image → nothing to trim; keep the photo
    // untouched by falling through to cancel (which just closes the modal).
    if (r.x <= 1 && r.y <= 1 && r.w >= dispW - 2 && r.h >= dispH - 2) {
      onCancel();
      return;
    }

    setBusy(true);
    try {
      // Map the displayed rect back to original pixels through fitScale.
      let originX = Math.round(r.x / fitScale);
      let originY = Math.round(r.y / fitScale);
      let cropW = Math.round(r.w / fitScale);
      let cropH = Math.round(r.h / fitScale);
      cropW = Math.max(1, Math.min(cropW, photo.width));
      cropH = Math.max(1, Math.min(cropH, photo.height));
      originX = Math.max(0, Math.min(originX, photo.width - cropW));
      originY = Math.max(0, Math.min(originY, photo.height - cropH));

      const context = ImageManipulator.manipulate(photo.uri);
      context.crop({ originX, originY, width: cropW, height: cropH });
      const rendered = await context.renderAsync();
      const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      // The crop box's pixel size is the output size — reported back so the
      // photo's width/height stay truthful for the upload resize pass, which
      // scales off them without decoding the file first.
      onDone({ uri: result.uri, mimeType: 'image/jpeg', width: cropW, height: cropH });
    } catch (error) {
      Alert.alert(
        "Couldn't crop photo",
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
      setBusy(false);
    }
  };

  if (!photo) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <PressableScale
            onPress={handleCancel}
            disabled={busy}
            hitSlop={8}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel="Cancel crop"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </PressableScale>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Crop photo</Text>
          </View>
          {busy ? (
            <ActivityIndicator color={COLORS.white} style={styles.doneSpinner} />
          ) : (
            <PressableScale
              onPress={handleDone}
              disabled={busy}
              hitSlop={8}
              scaleTo={0.92}
              accessibilityRole="button"
              accessibilityLabel="Done cropping"
            >
              <Text style={styles.doneText}>Done</Text>
            </PressableScale>
          )}
        </View>

        <View style={styles.workspace} onLayout={onWorkLayout}>
          {work && (
            <View
              style={{ position: 'absolute', left: imgLeft, top: imgTop, width: dispW, height: dispH }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={{ width: dispW, height: dispH }}
                contentFit="fill"
              />

              {/* Dim everything outside the crop rect — the photo stays faintly
                  visible through it, which is the point of a freeform trim. */}
              <View pointerEvents="none" style={[styles.dim, { left: 0, top: 0, width: dispW, height: rect.y }]} />
              <View
                pointerEvents="none"
                style={[styles.dim, { left: 0, top: rect.y + rect.h, width: dispW, height: dispH - (rect.y + rect.h) }]}
              />
              <View pointerEvents="none" style={[styles.dim, { left: 0, top: rect.y, width: rect.x, height: rect.h }]} />
              <View
                pointerEvents="none"
                style={[styles.dim, { left: rect.x + rect.w, top: rect.y, width: dispW - (rect.x + rect.w), height: rect.h }]}
              />

              {/* Crop rect: white border + thirds-grid, all decorative. */}
              <View
                pointerEvents="none"
                style={[styles.cropBox, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
              >
                <View style={[styles.gridLineV, { left: rect.w / 3 }]} />
                <View style={[styles.gridLineV, { left: (rect.w * 2) / 3 }]} />
                <View style={[styles.gridLineH, { top: rect.h / 3 }]} />
                <View style={[styles.gridLineH, { top: (rect.h * 2) / 3 }]} />
              </View>

              {/* Gesture layers: body translate under the corner handles. */}
              <View
                {...responders.body.panHandlers}
                style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              />
              <Handle corner="tl" left={rect.x - BRACKET} top={rect.y - BRACKET} handlers={responders.tl.panHandlers} />
              <Handle corner="tr" left={rect.x + rect.w - BRACKET} top={rect.y - BRACKET} handlers={responders.tr.panHandlers} />
              <Handle corner="bl" left={rect.x - BRACKET} top={rect.y + rect.h - BRACKET} handlers={responders.bl.panHandlers} />
              <Handle corner="br" left={rect.x + rect.w - BRACKET} top={rect.y + rect.h - BRACKET} handlers={responders.br.panHandlers} />
            </View>
          )}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <PressableScale
            onPress={handleReset}
            hitSlop={8}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel="Reset crop"
          >
            <Text style={styles.resetText}>Reset</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

// A 44pt touch target drawing an iOS-Photos L-bracket that opens toward the
// inside of the crop rect (the elbow sits on the rect corner).
function Handle({
  corner,
  left,
  top,
  handlers,
}: {
  corner: Corner;
  left: number;
  top: number;
  handlers: object;
}) {
  const isRight = corner === 'tr' || corner === 'br';
  const isBottom = corner === 'bl' || corner === 'br';
  const hEdge = isRight ? { right: BRACKET } : { left: BRACKET };
  const vEdge = isBottom ? { bottom: BRACKET } : { top: BRACKET };
  return (
    <View {...handlers} style={[styles.handle, { left, top }]}>
      <View style={[styles.bracket, { width: BRACKET, height: STROKE }, hEdge, vEdge]} />
      <View style={[styles.bracket, { width: STROKE, height: BRACKET }, hEdge, vEdge]} />
    </View>
  );
}

const GRID_COLOR = 'rgba(255,255,255,0.35)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // A crop surface is deliberately black in both themes — not a theme color.
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  cancelText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
  titleWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },
  doneText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  doneSpinner: {
    width: 44,
    alignItems: 'flex-end',
  },
  workspace: {
    flex: 1,
    // Margin, not padding: onLayout reports the view's own size, so with
    // margin the measured workspace equals the true area the fit math can
    // center the photo in (padding would inflate it by 32pt and let a wide
    // photo overflow the screen edge).
    margin: 16,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: GRID_COLOR,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GRID_COLOR,
  },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
  },
  bracket: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderRadius: 1.5,
  },
  bottomBar: {
    alignItems: 'center',
    paddingTop: 12,
  },
  resetText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
});
