import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import { SELLER_ARIA } from '../data/mockListings';
import { RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import PressableScale from '../components/PressableScale';
import AnimatedIconToggle from '../components/AnimatedIconToggle';

type Props = NativeStackScreenProps<RootStackParamList, 'ListingDetail'>;

const DOTS = [0, 1, 2, 3];

export default function ListingDetailScreen({ navigation, route }: Props) {
  const { listing } = route.params;

  const [saved, setSaved] = useState(listing.saved);
  const [activeDot, setActiveDot] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top controls */}
      <View style={styles.topBar}>
        <PressableScale style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }} scaleTo={0.9}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </PressableScale>
        <View style={styles.topRight}>
          <PressableScale style={styles.iconBtn} hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }} scaleTo={0.9}>
            <Ionicons name="share-outline" size={20} color={COLORS.text} />
          </PressableScale>
          <PressableScale style={styles.iconBtn} onPress={() => setSaved(s => !s)} hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }} scaleTo={0.9}>
            <AnimatedIconToggle
              active={saved}
              activeName="heart"
              inactiveName="heart-outline"
              activeColor="#E63946"
              inactiveColor={COLORS.text}
              size={20}
            />
          </PressableScale>
          <PressableScale style={styles.iconBtn} onPress={() => setReportVisible(true)} hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }} scaleTo={0.9}>
            <Ionicons name="flag-outline" size={20} color={COLORS.text} />
          </PressableScale>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Image Carousel Placeholder */}
        <View style={[styles.imagePlaceholder, { backgroundColor: listing.imageColor || '#EBE4F8' }]}>
          <Ionicons name="image-outline" size={48} color="rgba(26,26,46,0.3)" />
        </View>

        {/* Carousel Dots */}
        <View style={styles.dotsRow}>
          {DOTS.map(i => (
            <TouchableOpacity key={i} onPress={() => setActiveDot(i)}>
              <View style={[styles.dot, activeDot === i ? styles.dotActive : null]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.content}>
          {/* Price + condition */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>${listing.price}</Text>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{listing.condition}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Meta */}
          <Text style={styles.meta}>
            {listing.category} · Posted {listing.postedAgo} · {listing.views} views
          </Text>

          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.divider} />

          {/* Seller Card */}
          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() => navigation.navigate('SellerProfile', { seller: SELLER_ARIA })}
            activeOpacity={0.85}
          >
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInitials}>AK</Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{listing.seller.name}</Text>
                <View style={styles.sellerVerified}>
                  <View style={[styles.onlineDot, { backgroundColor: listing.seller.dotColor }]} />
                </View>
              </View>
              <Text style={styles.sellerMeta}>4.4 (152) · BMOS · Year {listing.seller.year}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Location */}
          <View style={styles.locationCard}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.locationTitle}>Campus pickup</Text>
              <Text style={styles.locationAddress}>{listing.pickup}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.offerBtn} activeOpacity={0.85}>
          <Text style={styles.offerText}>Make offer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.messageBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('Chat', {
              contact: {
                initials: 'AK',
                name: listing.seller.name,
                avatarColor: COLORS.primary,
              },
              listing,
            })
          }
        >
          <Ionicons name="chatbubble-outline" size={17} color={COLORS.white} />
          <Text style={styles.messageText}>Message</Text>
        </TouchableOpacity>
      </View>
      <ReportModal
        visible={reportVisible}
        target="listing"
        targetName={listing.title}
        onClose={() => setReportVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topRight: {
    flexDirection: 'row',
    gap: 8,
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
    paddingBottom: 20,
  },
  imagePlaceholder: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D8D8E0',
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 18,
  },
  content: {
    paddingHorizontal: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  conditionBadge: {
    backgroundColor: '#F0EAFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  conditionText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
    lineHeight: 26,
  },
  meta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F4',
    marginVertical: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitials: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  sellerVerified: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sellerMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F4',
    backgroundColor: COLORS.white,
  },
  offerBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  messageBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  messageText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
