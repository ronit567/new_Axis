import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import ListingCardSkeleton from '../components/ListingCardSkeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useSavedListings, useToggleSaved } from '../hooks/useSavedListings';
import { RootStackParamList, Listing } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const TABS = ['Items', 'Saved searches'];

export default function SavedScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState('Items');
  const { data, isLoading, isError, refetch } = useSavedListings();
  const toggleSavedMutation = useToggleSaved();
  const savedItems = data ?? [];
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    if (isLoading) anim.start();
    else { anim.stop(); pulseAnim.setValue(0.4); }
    return () => anim.stop();
  }, [isLoading, pulseAnim]);

  const renderItem = ({ item }: { item: Listing }) => (
    <ListingCard
      item={item}
      onPress={() => navigation.navigate('ListingDetail', { listing: item })}
      onSave={() => toggleSavedMutation.mutate(item)}
      style={styles.card}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
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
              {tab === 'Items' ? `Items  ${savedItems.length}` : 'Saved searches  2'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && activeTab === 'Items' ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map(rowIndex => (
            <View key={rowIndex} style={styles.row}>
              <ListingCardSkeleton animatedValue={pulseAnim} />
              <ListingCardSkeleton animatedValue={pulseAnim} />
            </View>
          ))}
        </View>
      ) : isError && activeTab === 'Items' ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : activeTab === 'Items' ? (
        <FlatList
          data={savedItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No saved items yet. Tap the heart on any listing to save it here."
              ctaLabel="Browse listings"
              onCta={() => navigation.navigate('Main')}
            />
          }
        />
      ) : (
        <View style={styles.savedSearches}>
          {['calc 1000 textbook', 'IKEA desk'].map(s => (
            <TouchableOpacity key={s} style={styles.savedSearchRow} activeOpacity={0.8}>
              <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.savedSearchText}>{s}</Text>
              <Ionicons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  savedSearches: {
    paddingHorizontal: 20,
    gap: 2,
  },
  savedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 12,
  },
  savedSearchText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
});
