import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import PressableScale from '../components/PressableScale';
import RemoteImage from '../components/RemoteImage';
import CategoryChip from '../components/CategoryChip';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import HeaderIconButton from '../components/layout/HeaderIconButton';
import { haptics } from '../lib/haptics';
import {
  useMyListings,
  useMarkListingSold,
  useRelistListing,
  useDeleteListing,
} from '../hooks/useListings';
import { RootStackParamList, MyListing } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageListings'>;

const TABS = ['Active', 'Sold'];

export default function ManageListingsScreen({ navigation }: Props) {
  const { data: listings = [], isLoading } = useMyListings();
  const markSold = useMarkListingSold();
  const relist = useRelistListing();
  const deleteListing = useDeleteListing();
  const [activeTab, setActiveTab] = useState('Active');

  const filtered = listings.filter(l =>
    activeTab === 'Active' ? l.status === 'active' : l.status === 'sold',
  );

  const surface = (title: string) => (e: unknown) =>
    Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  const handleMarkSold = (item: MyListing) => {
    haptics.impact();
    markSold.mutate(item.id, { onError: surface("Couldn't mark as sold") });
  };
  const handleRelist = (item: MyListing) => {
    haptics.impact();
    relist.mutate(item.id, { onError: surface("Couldn't relist") });
  };
  const handleDelete = (item: MyListing) => {
    haptics.tap();
    Alert.alert('Delete listing?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteListing.mutate(item.id, { onError: surface("Couldn't delete") }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: MyListing }) => {
    const isSold = item.status === 'sold';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.thumb, { backgroundColor: item.imageColor }]}>
            {item.thumbUrls[0] ? (
              <RemoteImage uri={item.thumbUrls[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : null}
            {isSold && (
              <View style={styles.soldOverlay}>
                <Text style={styles.soldOverlayText}>SOLD</Text>
              </View>
            )}
          </View>
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.badge, isSold ? styles.badgeSold : styles.badgeActive]}>
                <Text style={[styles.badgeText, isSold ? styles.badgeTextSold : styles.badgeTextActive]}>
                  {isSold ? 'Sold' : 'Active'}
                </Text>
              </View>
            </View>
            <Text style={styles.price}>
              ${isSold ? item.soldFor : item.price}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="eye-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.statText}>{item.views}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="heart-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.statText}>{item.saves}</Text>
              </View>
              <Text style={styles.posted}>{item.postedAgo}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {!isSold ? (
            <>
              <PressableScale
                style={styles.actionBtn}
                scaleTo={0.96}
                onPress={() => {
                  haptics.tap();
                  navigation.navigate('EditListing', { listingId: item.id });
                }}
                accessibilityLabel={`Edit ${item.title}`}
                accessibilityRole="button"
              >
                <Ionicons name="create-outline" size={16} color={COLORS.text} />
                <Text style={styles.actionText}>Edit</Text>
              </PressableScale>
              <PressableScale
                style={styles.actionBtn}
                scaleTo={0.96}
                onPress={() => handleMarkSold(item)}
                accessibilityLabel={`Mark ${item.title} as sold`}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.westernGreen} />
                <Text style={[styles.actionText, { color: COLORS.westernGreen }]}>Mark sold</Text>
              </PressableScale>
            </>
          ) : (
            <PressableScale
              style={styles.actionBtn}
              scaleTo={0.96}
              onPress={() => handleRelist(item)}
              accessibilityLabel={`Relist ${item.title}`}
              accessibilityRole="button"
            >
              <Ionicons name="repeat-outline" size={16} color={COLORS.text} />
              <Text style={styles.actionText}>Relist</Text>
            </PressableScale>
          )}
          <PressableScale
            style={[styles.actionBtn, styles.deleteBtn]}
            scaleTo={0.92}
            onPress={() => handleDelete(item)}
            accessibilityLabel={`Delete ${item.title}`}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </PressableScale>
        </View>
      </View>
    );
  };

  const activeCount = listings.filter(l => l.status === 'active').length;
  const soldCount = listings.filter(l => l.status === 'sold').length;

  return (
    <Screen>
      <ScreenHeader
        title="My listings"
        onBack={() => navigation.goBack()}
        bordered
        trailing={
          <HeaderIconButton
            icon="add"
            accessibilityLabel="Create new listing"
            color={COLORS.primary}
            size={24}
            onPress={() => {
              haptics.tap();
              navigation.navigate('CreateListing');
            }}
          />
        }
      />

      {/* Tabs — the shared chip again, so Active/Sold here behaves exactly
          like the filters on Messages and Saved. */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <CategoryChip
            key={tab}
            label={`${tab}  ${tab === 'Active' ? activeCount : soldCount}`}
            active={activeTab === tab}
            onPress={() => {
              haptics.tap();
              setActiveTab(tab);
            }}
          />
        ))}
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.card}>
              <View style={styles.cardTop}>
                <SkeletonLoader
                  width={64}
                  height={64}
                  borderRadius={SIZES.borderRadiusSm}
                />
                <View style={styles.skeletonInfo}>
                  <SkeletonLoader width="70%" height={14} />
                  <SkeletonLoader width="30%" height={16} />
                  <SkeletonLoader width="50%" height={12} />
                </View>
              </View>
              <View style={styles.actions}>
                <SkeletonLoader width="100%" height={44} style={styles.skeletonAction} />
                <SkeletonLoader width="100%" height={44} style={styles.skeletonAction} />
              </View>
            </View>
          ))}
        </View>
      ) : (
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          activeTab === 'Active' ? (
            <EmptyState
              icon="pricetags-outline"
              title="No active listings yet."
              ctaLabel="Post your first listing"
              onCta={() => navigation.navigate('CreateListing')}
            />
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              iconColor={COLORS.westernGreen}
              iconBg={COLORS.successSoft}
              title="Nothing sold yet. Mark an item as sold to see it here."
              ctaLabel="View active listings"
              onCta={() => setActiveTab('Active')}
            />
          )
        }
      />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* tabs */
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    paddingTop: 16,
    marginBottom: 8,
  },
  /* list */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: COLORS.white,
    // Was borderRadiusLg (20) while Settings' card used 12 — same name, same
    // role, different shape. Both now sit on the shared radius.
    borderRadius: SIZES.borderRadius,
    borderCurve: 'continuous',
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.card,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlayText: {
    color: COLORS.white,
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    letterSpacing: 1,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonAction: {
    flex: 1,
    borderRadius: SIZES.borderRadius,
  },
  title: {
    flex: 1,
    fontSize: SIZES.md,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SIZES.borderRadiusSm,
  },
  badgeActive: {
    backgroundColor: COLORS.successSoft,
  },
  badgeSold: {
    backgroundColor: COLORS.surfaceAlt,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONTS.semibold,
    letterSpacing: 0.3,
  },
  badgeTextActive: {
    color: COLORS.westernGreen,
  },
  badgeTextSold: {
    color: COLORS.textMuted,
  },
  price: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  posted: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },

  /* actions */
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 44,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.white,
  },
  actionText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
  },
  deleteBtn: {
    flex: 0,
    width: 44,
    borderColor: COLORS.error,
  },
});
