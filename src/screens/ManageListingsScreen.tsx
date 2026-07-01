import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import { MY_LISTINGS } from '../data/mockListings';
import { RootStackParamList, MyListing } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageListings'>;

const TABS = ['Active', 'Sold'];

export default function ManageListingsScreen({ navigation }: Props) {
  const [listings, setListings] = useState(MY_LISTINGS);
  const [activeTab, setActiveTab] = useState('Active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const filtered = listings.filter(l =>
    activeTab === 'Active' ? l.status === 'active' : l.status === 'sold',
  );

  const markSold = (id: string) =>
    setListings(prev =>
      prev.map(l => (l.id === id ? { ...l, status: 'sold' as const, soldFor: l.price } : l)),
    );

  const deleteListing = (id: string) => {
    Alert.alert('Delete listing?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setListings(prev => prev.filter(l => l.id !== id)),
      },
    ]);
  };

  const renderItem = ({ item }: { item: MyListing }) => {
    const isSold = item.status === 'sold';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.thumb, { backgroundColor: item.imageColor }]}>
            {isSold && (
              <View style={styles.soldOverlay}>
                <Text style={styles.soldOverlayText}>SOLD</Text>
              </View>
            )}
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.price}>
              ${isSold ? item.soldFor : item.price}
              {isSold ? <Text style={styles.soldLabel}>  · sold</Text> : null}
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
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('CreateListing')}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.text} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.8}
                onPress={() => markSold(item.id)}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.westernGreen} />
                <Text style={[styles.actionText, { color: COLORS.westernGreen }]}>Mark sold</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CreateListing')}
            >
              <Ionicons name="repeat-outline" size={16} color={COLORS.text} />
              <Text style={styles.actionText}>Relist</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            activeOpacity={0.8}
            onPress={() => deleteListing(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const activeCount = listings.filter(l => l.status === 'active').length;
  const soldCount = listings.filter(l => l.status === 'sold').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My listings</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateListing')}
          style={styles.headerBtn}
        >
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab ? styles.tabActive : null]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : null]}>
              {tab}  {tab === 'Active' ? activeCount : soldCount}
            </Text>
          </TouchableOpacity>
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
                <SkeletonLoader width="100%" height={38} style={styles.skeletonAction} />
                <SkeletonLoader width="100%" height={38} style={styles.skeletonAction} />
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
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'Active' ? 'No active listings' : 'Nothing sold yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'Active'
                ? 'Tap + to post something for sale.'
                : 'Items you mark as sold will appear here.'}
            </Text>
          </View>
        }
      />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F5FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerBtn: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* tabs */
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    paddingTop: 16,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },

  /* list */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.borderRadius,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: SIZES.borderRadiusSm,
    overflow: 'hidden',
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
    fontWeight: '700',
    letterSpacing: 1,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonAction: {
    flex: 1,
    borderRadius: SIZES.borderRadiusSm,
  },
  title: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  price: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  soldLabel: {
    fontSize: SIZES.xs,
    fontWeight: '500',
    color: COLORS.textMuted,
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
  },
  posted: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },

  /* actions */
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.white,
  },
  actionText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  deleteBtn: {
    flex: 0,
    width: 44,
  },

  /* empty */
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
