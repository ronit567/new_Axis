import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import ListingCard from '../components/ListingCard';
import { LISTINGS } from '../data/mockListings';

const CATEGORIES = ['All', 'Textbooks', 'Furniture', 'Tickets'];

export default function HomeScreen({ navigation }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [savedIds, setSavedIds] = useState([]);

  const filtered =
    activeCategory === 'All'
      ? LISTINGS
      : LISTINGS.filter(l => l.category === activeCategory);

  const toggleSave = id =>
    setSavedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const renderItem = ({ item }) => (
    <ListingCard
      item={{ ...item, saved: savedIds.includes(item.id) || item.saved }}
      onPress={() => navigation.navigate('ListingDetail', { listing: item })}
      onSave={() => toggleSave(item.id)}
      style={styles.card}
    />
  );

  const ListHeader = (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>For you</Text>
      <TouchableOpacity>
        <Text style={styles.seeAll}>See all</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>R</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Hi, Ronit</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.location}>Western, London, ON</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.85}
      >
        <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
        <Text style={styles.searchPlaceholder}>Search textbooks, furniture...</Text>
        <View style={styles.filterDivider} />
        <TouchableOpacity
          style={styles.filterIconBtn}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="options-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Category chips */}
      <View style={styles.categoryRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catChip,
              activeCategory === cat ? styles.catChipActive : null,
            ]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.catLabel,
                activeCategory === cat ? styles.catLabelActive : null,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Listing Grid */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
      />
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
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchPlaceholder: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E8E8E8',
  },
  filterIconBtn: {
    paddingLeft: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  catLabelActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
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
});
