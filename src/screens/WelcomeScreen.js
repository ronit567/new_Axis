import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../constants/theme';

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.container}>
        <View style={styles.topSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🎓</Text>
          </View>
          <Text style={styles.brandName}>Axis</Text>
          <Text style={styles.tagline}>
            Buy, sell & trade with verified{'\n'}Western students — right on{'\n'}campus.
          </Text>
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>🔒  Verified Western students only</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreateAccount')}
            activeOpacity={0.85}
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
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  topSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 38,
  },
  brandName: {
    fontSize: SIZES.xxxl,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: SIZES.base,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    gap: 12,
  },
  verifiedBadge: {
    alignItems: 'center',
    marginBottom: 4,
  },
  verifiedText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: SIZES.sm,
  },
  createBtn: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: COLORS.primary,
    fontSize: SIZES.base,
    fontWeight: '600',
  },
  signInBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: SIZES.borderRadius,
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  signInBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
  },
});
