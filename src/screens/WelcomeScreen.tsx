import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, GRADIENTS } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <LinearGradient colors={GRADIENTS.primaryRadiant} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={styles.bg}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
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

            <Text style={styles.tagline}>
              {'Buy, sell & trade with verified\nWestern students \u2014 right on\ncampus.'}
            </Text>
          </View>

          {/* ── CTA area ── */}
          <View style={styles.bottomSection}>
            <View style={styles.badgePill}>
              <Ionicons
                name="shield-checkmark-outline"
                size={15}
                color="rgba(255,255,255,0.75)"
              />
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
  brandName: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
    marginBottom: 14,
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
    borderRadius: 30,
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
    borderRadius: 30,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
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
