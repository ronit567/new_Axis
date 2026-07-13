import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  Animated,
  Easing,
  AccessibilityInfo,
  LayoutChangeEvent,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { COLORS, SIZES, GRADIENTS, FONTS, SHADOWS } from '../constants/theme';
import PressableScale from '../components/PressableScale';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

// Elements rise through this offset (pt) on entrance; every spring settles to
// today's exact at-rest layout, so 0 is the real position — nothing shifts it.
const RISE = 14;

// Ambient orb tint fading to fully-transparent purple (same hue as the top of
// GRADIENTS.primaryRadiant) so the blobs read as glow, not solid shapes.
const ORB_COLORS = ['#6E3AAE', '#6E3AAE', 'rgba(110,58,174,0)'] as const;

export default function WelcomeScreen({ navigation }: Props) {
  // null until AccessibilityInfo resolves; gates every loop + the shine sweep.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  // Measured so the sweep travels exactly one wordmark width, edge to edge.
  const [wordmarkWidth, setWordmarkWidth] = useState(0);

  // Entrance progress per element (0 hidden → 1 at rest), staggered on mount.
  const logoV = useRef(new Animated.Value(0)).current;
  const wordV = useRef(new Animated.Value(0)).current;
  const taglineV = useRef(new Animated.Value(0)).current;
  const pillV = useRef(new Animated.Value(0)).current;
  const createV = useRef(new Animated.Value(0)).current;
  const signInV = useRef(new Animated.Value(0)).current;

  // Idle loops — started only after the entrance and only when motion is allowed.
  const bob = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;
  const drift3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    const running: Animated.CompositeAnimation[] = [];
    const entrance = [logoV, wordV, taglineV, pillV, createV, signInV];

    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!mounted) return;
      setReduceMotion(rm);

      // Reduce Motion: no drift/bob/sweep — collapse to a single flat 200ms fade.
      if (rm) {
        const fade = Animated.parallel(
          entrance.map((v) =>
            Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true }),
          ),
        );
        running.push(fade);
        fade.start();
        return;
      }

      // Cascade in; springs are stiff enough to settle well under 900ms.
      const cascade = Animated.stagger(
        90,
        entrance.map((v) =>
          Animated.spring(v, { toValue: 1, friction: 9, tension: 80, useNativeDriver: true }),
        ),
      );
      running.push(cascade);
      cascade.start(({ finished }) => {
        if (!mounted || !finished) return;
        // Logo idle float (±5pt, 4s cycle) and a one-shot wordmark shine.
        const bobLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(bob, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(bob, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        );
        const sweep = Animated.sequence([
          Animated.delay(500),
          Animated.timing(shine, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]);
        running.push(bobLoop, sweep);
        bobLoop.start();
        sweep.start();
      });

      // Ambient orbs drift immediately; distinct round-trips + one-shot phase
      // offsets keep them from ever moving in unison.
      const drift = (v: Animated.Value, roundTrip: number, phase: number) =>
        Animated.sequence([
          Animated.delay(phase),
          Animated.loop(
            Animated.sequence([
              Animated.timing(v, { toValue: 1, duration: roundTrip / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(v, { toValue: 0, duration: roundTrip / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
          ),
        ]);
      const orbs = [drift(drift1, 13000, 0), drift(drift2, 15000, 1500), drift(drift3, 11000, 3000)];
      orbs.forEach((o) => {
        running.push(o);
        o.start();
      });
    });

    return () => {
      mounted = false;
      running.forEach((a) => a.stop());
    };
  }, [logoV, wordV, taglineV, pillV, createV, signInV, bob, shine, drift1, drift2, drift3]);

  // At Reduce Motion the transforms hold at rest; opacity alone carries the fade.
  const rest = reduceMotion === true;
  const opacityOf = (v: Animated.Value) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const riseOf = (v: Animated.Value): Animated.AnimatedInterpolation<number> | number =>
    rest ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] });
  const logoScale = rest ? 1 : logoV.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-wordmarkWidth, wordmarkWidth] });

  // translateX/translateY/scale from one 0→1 value per orb.
  const orbTransform = (v: Animated.Value, dx: number, dy: number, sc: number) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, sc] }) },
    ],
  });

  const onWordmarkLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWordmarkWidth((prev) => (prev === w ? prev : w));
  };

  return (
    <LinearGradient colors={GRADIENTS.primaryRadiant} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={styles.bg}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* ── Ambient orbs — behind all content, never interactive ── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.orb, styles.orb1, orbTransform(drift1, 26, 30, 1.08)]}>
          <LinearGradient colors={ORB_COLORS} locations={[0, 0.45, 1]} start={{ x: 0.25, y: 0.2 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[styles.orb, styles.orb2, orbTransform(drift2, -30, -20, 1.06)]}>
          <LinearGradient colors={ORB_COLORS} locations={[0, 0.45, 1]} start={{ x: 0.3, y: 0.25 }} end={{ x: 1, y: 0.95 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[styles.orb, styles.orb3, orbTransform(drift3, 22, -26, 1.05)]}>
          <LinearGradient colors={ORB_COLORS} locations={[0, 0.45, 1]} start={{ x: 0.2, y: 0.3 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>

          {/* ── Logo + title ── */}
          <View style={styles.topSection}>
            <Animated.View
              style={[
                styles.logoBox,
                { opacity: opacityOf(logoV), transform: [{ translateY: Animated.add(riseOf(logoV), bobY) }, { scale: logoScale }] },
              ]}
            >
              <Image
                source={require('../../Logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </Animated.View>

            <View style={styles.wordmarkWrap} onLayout={onWordmarkLayout}>
              <Animated.Text
                style={[styles.brandName, { opacity: opacityOf(wordV), transform: [{ translateY: riseOf(wordV) }] }]}
              >
                Axis
              </Animated.Text>
              {/* Shine sweep: additive highlight masked to the text, so the real
                  wordmark above owns layout and the sweep can never disturb it. */}
              {reduceMotion === false && wordmarkWidth > 0 ? (
                <MaskedView
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  maskElement={<Text style={styles.brandName}>Axis</Text>}
                >
                  <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shineX }] }]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.9)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shineBand}
                    />
                  </Animated.View>
                </MaskedView>
              ) : null}
            </View>

            <Animated.Text
              style={[styles.tagline, { opacity: opacityOf(taglineV), transform: [{ translateY: riseOf(taglineV) }] }]}
            >
              {'Buy, sell & trade with verified\nWestern students — right on\ncampus.'}
            </Animated.Text>
          </View>

          {/* ── CTA area ── */}
          <View style={styles.bottomSection}>
            <Animated.View
              style={[styles.badgePill, { opacity: opacityOf(pillV), transform: [{ translateY: riseOf(pillV) }] }]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={15}
                color="rgba(255,255,255,0.75)"
              />
              <Text style={styles.badgeText}>Verified Western students only</Text>
            </Animated.View>

            <Animated.View style={{ opacity: opacityOf(createV), transform: [{ translateY: riseOf(createV) }] }}>
              <PressableScale
                style={styles.createBtn}
                onPress={() => {
                  haptics.impact();
                  navigation.navigate('CreateAccount');
                }}
                scaleTo={0.96}
                accessibilityRole="button"
              >
                <Text style={styles.createBtnText}>Create account</Text>
              </PressableScale>
            </Animated.View>

            <Animated.View style={{ opacity: opacityOf(signInV), transform: [{ translateY: riseOf(signInV) }] }}>
              <PressableScale
                style={styles.signInBtn}
                onPress={() => {
                  haptics.tap();
                  navigation.navigate('SignIn');
                }}
                scaleTo={0.96}
                accessibilityRole="button"
              >
                <Text style={styles.signInBtnText}>Sign in</Text>
              </PressableScale>
            </Animated.View>
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },

  /* ambient orbs — clipped to circles, soft opacity, bleeding off-screen */
  orb: {
    position: 'absolute',
    overflow: 'hidden',
  },
  orb1: {
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -90,
    right: -110,
    opacity: 0.3,
  },
  orb2: {
    width: 300,
    height: 300,
    borderRadius: 150,
    top: '34%',
    left: -130,
    opacity: 0.26,
  },
  orb3: {
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -70,
    right: -80,
    opacity: 0.28,
  },

  /* top */
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 10,
  },
  logoImg: {
    width: 60,
    height: 60,
  },
  // marginBottom lives on the wrapper so the shine mask aligns to the glyphs.
  wordmarkWrap: {
    marginBottom: 14,
  },
  brandName: {
    fontSize: 48,
    fontFamily: FONTS.extraBold,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  shineBand: {
    flex: 1,
  },
  tagline: {
    fontSize: SIZES.base,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 26,
  },

  /* bottom */
  bottomSection: {
    gap: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 6,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: SIZES.sm,
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.raised,
  },
  createBtnText: {
    color: COLORS.primary,
    fontSize: SIZES.base,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signInBtn: {
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  signInBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
