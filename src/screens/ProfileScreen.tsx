import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LISTINGS as MOCK_LISTINGS } from '../data/mockListings';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';
import { RootStackParamList } from '../types';
import PressableScale from '../components/PressableScale';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type MenuItem = {
  icon: IoniconsName;
  label: string;
  target: 'EditProfile' | 'Settings' | null;
};

const { width } = Dimensions.get('window');
const H_PAD = 24;
const CARD_GAP = 8;
const THUMB_WIDTH = (width - H_PAD * 2 - CARD_GAP * 2) / 3;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * 0.95);

function HatchedThumb({ isSold }: { isSold: boolean }) {
  return (
    <View
      style={[
        styles.thumb,
        { backgroundColor: isSold ? '#C0BCBC' : '#C4B2E0' },
      ]}
    >
      {Array.from({ length: 30 }).map((_, i) => (
        <View key={i} style={[styles.hatchLine, { top: i * 9 - 20 }]} />
      ))}
      {isSold && (
        <View style={styles.soldOverlay}>
          <Text style={styles.soldOverlayText}>SOLD</Text>
        </View>
      )}
    </View>
  );
}


const MENU: MenuItem[] = [
  { icon: 'create-outline', label: 'Edit profile', target: 'EditProfile' },
  { icon: 'help-circle-outline', label: 'Help & support', target: null },
  { icon: 'settings-outline', label: 'Settings', target: 'Settings' },
];

const MY_LISTINGS = MOCK_LISTINGS.slice(0, 3);

export default function ProfileScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar (gear icon) ── */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.gearBtn}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
            scaleTo={0.9}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
          </PressableScale>
        </View>

        {/* ── Profile info ── */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>RS</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>Ronit S.</Text>
          </View>
          <Text style={styles.programText}>Ivey HBA · Year 2</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={COLORS.warning} />
            <Text style={styles.ratingScore}> 5.0 </Text>
            <Text style={styles.ratingCount}>(18)</Text>
          </View>
        </View>

        {/* ── Stats bar ── */}
        <View style={styles.statsCard}>
          {[['6', 'Listings'], ['23', 'Sold'], ['8', 'Saved']].map(
            ([n, l], i) => (
              <React.Fragment key={l}>
                {i > 0 && <View style={styles.statDivider} />}
                <View style={styles.statCell}>
                  <Text style={styles.statNum}>{n}</Text>
                  <Text style={styles.statLabel}>{l}</Text>
                </View>
              </React.Fragment>
            ),
          )}
        </View>

        {/* ── My Listings ── */}
        <View style={styles.listingsBlock}>
          <View style={styles.listingsTopRow}>
            <Text style={styles.listingsTitle}>My listings</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ManageListings')}>
              <Text style={styles.manageText}>Manage</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listingsRow}>
            {MY_LISTINGS.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.listingItem}
                onPress={() => navigation.navigate('ListingDetail', { listing: item })}
                activeOpacity={0.85}
              >
                <HatchedThumb isSold={item.condition === 'Sold'} />
                <Text
                  style={[
                    styles.priceText,
                    item.condition === 'Sold' ? styles.priceTextSold : null,
                  ]}
                >
                  ${item.price}
                </Text>
                <Text style={styles.statusText}>{item.condition}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Menu card ── */}
        <View style={styles.menuCard}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.menuRow,
                i < MENU.length - 1 ? styles.menuRowBorder : null,
              ]}
              onPress={() => item.target ? navigation.navigate(item.target) : null}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBox}>
                  <Ionicons name={item.icon} size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EDEAF6',
  },
  scroll: {
    paddingBottom: 20,
  },

  /* top bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 8,
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* profile */
  profileSection: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C4B2E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  programText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingScore: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  ratingCount: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },

  /* stats */
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: H_PAD,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 16,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  statNum: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* listings */
  listingsBlock: {
    marginHorizontal: H_PAD,
    marginBottom: 16,
  },
  listingsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listingsTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  manageText: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  listingsRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  listingItem: {
    width: THUMB_WIDTH,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: SIZES.borderRadiusSm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 6,
  },
  hatchLine: {
    position: 'absolute',
    width: 220,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.42)',
    transform: [{ rotate: '-45deg' }],
    left: -60,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlayText: {
    color: COLORS.white,
    fontSize: SIZES.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  priceText: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  priceTextSold: {
    color: COLORS.textMuted,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },

  /* menu */
  menuCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: H_PAD,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 16,
    ...SHADOWS.card,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
});
