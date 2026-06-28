import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES } from '../constants/theme';

const { width: SW, height: SH } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  return (
    <LinearGradient
      colors={['#6A35A8', '#5C2D91', '#3A0D70']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      {/* Radial centre-glow to approximate the design's radial gradient */}
      <View style={styles.glowOuter} pointerEvents="none" />
      <View style={styles.glowInner} pointerEvents="none" />

      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>

          {/* ── Logo + title ── */}
          <View style={styles.topSection}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../Logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.brandName}>Axis</Text>

            <View style={styles.divider} />

            <Text style={styles.tagline}>
              Buy, sell & trade with verified{'\n'}
              Western students — right on{'\n'}
              campus.
            </Text>
          </View>

          {/* ── CTA area ── */}
          <View style={styles.bottomSection}>
            <View style={styles.badgeRow}>
              <View style={styles.shieldBadge}>
                <Text style={styles.shieldCheck}>✓</Text>
              </View>
              <Text style={styles.badgeText}>Verified Western students only</Text>
            </View>

            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('CreateAccount')}
              activeOpacity={0.9}
            >
              <Text style={styles.createBtnText}>Create account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => navigation.navigate('SignIn')}
              activeOpacity={0.85}
            >
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  /* radial glow layers – stacked transparent circles to mimic radial gradient */
  glowOuter: {
    position: 'absolute',
    width: SW * 1.8,
    height: SW * 1.8,
    borderRadius: SW * 0.9,
    backgroundColor: '#8050CC',
    opacity: 0.22,
    top: SH * 0.04,
    left: -SW * 0.4,
  },
  glowInner: {
    position: 'absolute',
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    backgroundColor: '#9060D8',
    opacity: 0.18,
    top: SH * 0.12,
    left: SW * 0.05,
  },
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },

  /* top */
  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  logoImg: {
    width: 54,
    height: 54,
  },
  brandName: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  divider: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginBottom: 20,
  },
  tagline: {
    fontSize: SIZES.base,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    lineHeight: 26,
  },

  /* bottom */
  bottomSection: {
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  shieldBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCheck: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: SIZES.sm,
  },
  createBtn: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  createBtnText: {
    color: COLORS.primary,
    fontSize: SIZES.base,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signInBtn: {
    borderRadius: 30,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  signInBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
