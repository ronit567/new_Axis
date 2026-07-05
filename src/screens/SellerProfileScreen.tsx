import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SHADOWS, SIZES } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import EmptyState from '../components/EmptyState';
import { ARIA_LISTINGS } from '../data/mockListings';
import { RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import PressableScale from '../components/PressableScale';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

export default function SellerProfileScreen({ navigation, route }: Props) {
  const { seller } = route.params;
  const [following, setFollowing] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const stars = Math.round(seller.rating);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      {/* Nav bar */}
      <View style={styles.navBar}>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </PressableScale>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => {
            haptics.tap();
            setReportVisible(true);
          }}
          hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.text} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: seller.avatarColor }]}>
            <Text style={styles.avatarText}>{seller.initials}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.sellerName}>{seller.name}</Text>
          </View>
          <Text style={styles.joinedText}>
            {seller.program} · Joined {seller.joinedDate}
          </Text>
          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < stars ? 'star' : 'star-outline'}
                size={14}
                color={COLORS.warning}
              />
            ))}
            <Text style={styles.ratingText}>
              {seller.rating} ({seller.reviewCount} reviews)
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{seller.stats.listings}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{seller.stats.sold}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{seller.stats.replyTime}</Text>
            <Text style={styles.statLabel}>Replies</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <PressableScale
            style={styles.messageBtn}
            scaleTo={0.97}
            onPress={() => {
              haptics.tap();
              navigation.navigate('Chat', {
                contact: {
                  initials: seller.initials,
                  name: seller.name,
                  avatarColor: seller.avatarColor,
                },
              });
            }}
          >
            <Text style={styles.messageBtnText}>Message</Text>
          </PressableScale>
          <PressableScale
            style={[styles.followBtn, following ? styles.followBtnActive : null]}
            scaleTo={0.97}
            onPress={() => {
              haptics.tap();
              setFollowing(f => !f);
            }}
          >
            <Text style={[styles.followBtnText, following ? styles.followBtnTextActive : null]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </PressableScale>
        </View>

        {/* Active Listings */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>Active listings</Text>
          {ARIA_LISTINGS.length > 0 ? (
            <View style={styles.listingsGrid}>
              {ARIA_LISTINGS.map((item, index) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  onPress={() => navigation.navigate('ListingDetail', { listing: item })}
                  onSave={() => {}}
                  style={styles.gridCard}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="storefront-outline"
              title={`${seller.name} doesn't have any active listings right now.`}
              ctaLabel="Go back"
              onCta={() => navigation.goBack()}
            />
          )}
        </View>
      </ScrollView>
      <ReportModal
        visible={reportVisible}
        target="user"
        targetName={seller.name}
        onClose={() => setReportVisible(false)}
        onBlock={() => setBlocked(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sellerName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  joinedText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    ...SHADOWS.card,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    marginBottom: 3,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  messageBtn: {
    flex: 1,
    height: 48,
    borderRadius: SIZES.borderRadius,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.brand,
  },
  messageBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  followBtn: {
    flex: 1,
    height: 48,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  followBtnActive: {
    backgroundColor: COLORS.primarySoft,
  },
  followBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  followBtnTextActive: {
    color: COLORS.primary,
  },
  listingsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 14,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '47%',
  },
});
