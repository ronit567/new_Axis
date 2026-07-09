import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../components/PressableScale';
import { COLORS, FONTS, SHADOWS } from '../constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type BannerContent = {
  title: string;
  body?: string;
  icon?: IoniconName;
  // Fired when the banner is tapped (e.g. navigate to the relevant screen).
  onPress?: () => void;
};

type BannerContextValue = { show: (content: BannerContent) => void };

const BannerContext = createContext<BannerContextValue | undefined>(undefined);

// How long a banner stays before auto-dismissing.
const VISIBLE_MS = 4000;
const OFFSCREEN = -220;

/**
 * Renders the app tree plus a top-anchored banner overlay, and exposes
 * `useNotificationBanner().show(...)`. This is the in-app, foreground surface
 * for realtime notifications (a new message / listing save while the app is
 * open): the realtime INSERT handler calls `show(...)` so something actually
 * appears, instead of only the silent Home bell dot updating.
 *
 * Backgrounded / closed-app delivery is a separate concern (OS push) — this
 * only fires while the JS runtime is alive and the provider is mounted.
 */
export function NotificationBannerProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<BannerContent | null>(null);
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const hide = useCallback(() => {
    clearTimer();
    Animated.timing(translateY, {
      toValue: OFFSCREEN,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Only unmount if this animation completed — a new show() interrupts it
      // and will manage its own content.
      if (finished) setContent(null);
    });
  }, [translateY]);

  const show = useCallback((next: BannerContent) => {
    // Replace whatever is showing with the newest event (the effect below
    // re-runs on the new content and re-animates + re-arms the timer).
    setContent(next);
  }, []);

  useEffect(() => {
    if (!content) return undefined;
    translateY.setValue(OFFSCREEN);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 7,
      speed: 13,
    }).start();
    hideTimer.current = setTimeout(hide, VISIBLE_MS);
    return clearTimer;
  }, [content, hide, translateY]);

  return (
    <BannerContext.Provider value={{ show }}>
      <View style={styles.root}>
        {children}
        {content && (
          // box-none: the wrapper spans the top of the screen but only the
          // banner card itself is touchable — taps elsewhere pass through to
          // the app underneath.
          <Animated.View
            style={[styles.wrap, { paddingTop: insets.top + 8, transform: [{ translateY }] }]}
            pointerEvents="box-none"
          >
            <PressableScale
              style={styles.banner}
              scaleTo={0.98}
              onPress={() => {
                content.onPress?.();
                hide();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${content.title}${content.body ? `. ${content.body}` : ''}`}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={content.icon ?? 'notifications'} size={18} color={COLORS.white} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.title} numberOfLines={1}>
                  {content.title}
                </Text>
                {content.body ? (
                  <Text style={styles.body} numberOfLines={2}>
                    {content.body}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </BannerContext.Provider>
  );
}

export function useNotificationBanner(): BannerContextValue {
  const ctx = useContext(BannerContext);
  if (!ctx) {
    throw new Error('useNotificationBanner must be used within a NotificationBannerProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...SHADOWS.floating,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  body: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});
