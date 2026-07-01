import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { SAVED_LISTINGS } from '../data/mockListings';
import { RootStackParamList, Listing } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const TABS = ['Items', 'Saved searches'];

export default function SavedScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState('Items');
  const [savedItems, setSavedItems] = useState(SAVED_LISTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1200);
  };

  const toggleSave = (id: string) =>
    setSavedItems(prev => prev.filter(l => l.id !== id));

  const renderItem = ({ item }: { item: Listing }) => (
    <ListingCard
      item={item}
      onPress={() => navigation.navigate('ListingDetail', { listing: item })}
      onSave={() => toggleSave(item.id)}
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
              {[0, 1].map(colIndex => (
                <View key={colIndex} style={styles.skeletonCard}>
                  <SkeletonLoader width="100%" height={128} borderRadius={0} />
                  <View style={styles.skeletonInfo}>
                    <SkeletonLoader width="40%" height={15} />
                    <SkeletonLoader width="90%" height={12} />
                    <SkeletonLoader width="70%" height={11} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : hasError && activeTab === 'Items' ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={handleRetry}
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🤍</Text>
              <Text style={styles.emptyTitle}>No saved items yet</Text>
              <Text style={styles.emptySubtitle}>Tap the heart on any listing to save it here.</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.savedSearches}>
          {['calc 1000 textbook', 'IKEA desk'].map(s => (
            <TouchableOpacity key={s} style={styles.savedSearchRow} activeOpacity={0.8}>
              <Text style={styles.savedSearchIcon}>🔍</Text>
              <Text style={styles.savedSearchText}>{s}</Text>
              <Text style={styles.savedSearchDelete}>✕</Text>
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
    backgroundColor: '#F5F5FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
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
  skeletonCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
  },
  skeletonInfo: {
    padding: 10,
    gap: 7,
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
  savedSearchIcon: {
    fontSize: 14,
  },
  savedSearchText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  savedSearchDelete: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
