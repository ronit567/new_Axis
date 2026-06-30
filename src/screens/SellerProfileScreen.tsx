import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import { ARIA_LISTINGS } from '../data/mockListings';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerProfile'>;

export default function SellerProfileScreen({ navigation, route }: Props) {
  const { seller } = route.params;
  const [following, setFollowing] = useState(false);

  const stars = Math.round(seller.rating);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: seller.avatarColor }]}>
            <Text style={styles.avatarText}>{seller.initials}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.sellerName}>{seller.name}</Text>
            {seller.verified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.verifiedText}>Western verified</Text>
              </View>
            ) : null}
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
                color="#F4A623"
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
          <TouchableOpacity
            style={styles.messageBtn}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('Chat', {
                contact: {
                  initials: seller.initials,
                  name: seller.name,
                  avatarColor: seller.avatarColor,
                },
              })
            }
          >
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.followBtn, following ? styles.followBtnActive : null]}
            onPress={() => setFollowing(f => !f)}
            activeOpacity={0.85}
          >
            <Text style={[styles.followBtnText, following ? styles.followBtnTextActive : null]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Listings */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>Active listings</Text>
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
        </View>
      </ScrollView>
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
    backgroundColor: '#F4F4F8',
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
    fontWeight: '700',
    color: COLORS.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF7EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '600',
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
    backgroundColor: '#F8F8FB',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E4E4E4',
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
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  followBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  followBtnActive: {
    backgroundColor: '#F0EAFF',
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
    fontWeight: '700',
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
