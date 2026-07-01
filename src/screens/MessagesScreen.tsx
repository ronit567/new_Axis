import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import ErrorState from '../components/ErrorState';
import { RootStackParamList } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

type Conversation = {
  id: string;
  initials: string;
  avatarColor: string;
  name: string;
  preview: string;
  time: string;
  unread: boolean;
  type: string;
};

const FILTERS = ['All', 'Buying', 'Selling'];

const CONVERSATIONS = [
  {
    id: '1',
    initials: 'AK',
    avatarColor: COLORS.primary,
    name: 'Aria K.',
    preview: 'Sounds good – UCC at 3pm w...',
    time: '2m',
    unread: true,
    type: 'Buying',
  },
  {
    id: '2',
    initials: 'MP',
    avatarColor: '#7B7BAF',
    name: 'Maya P.',
    preview: 'Is the textbook still available?',
    time: '1h',
    unread: true,
    type: 'Selling',
  },
  {
    id: '3',
    initials: 'LT',
    avatarColor: '#5E9E8F',
    name: 'Liam T.',
    preview: 'Can you do $25 for the desk?',
    time: '3h',
    unread: false,
    type: 'Selling',
  },
  {
    id: '4',
    initials: 'NR',
    avatarColor: '#B07A5A',
    name: 'Noah R.',
    preview: 'Thanks! Just use the e-transfer',
    time: 'Yesterday',
    unread: false,
    type: 'Buying',
  },
  {
    id: '5',
    initials: 'PM',
    avatarColor: '#A05CB5',
    name: 'Priya M.',
    preview: 'Where on campus works for you?',
    time: 'Wed',
    unread: false,
    type: 'Selling',
  },
];

export default function MessagesScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState('All');
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

  const filtered =
    activeFilter === 'All'
      ? CONVERSATIONS
      : CONVERSATIONS.filter(c => c.type === activeFilter);

  const renderItem = ({ item, index }: { item: Conversation; index: number }) => (
    <TouchableOpacity
      style={[styles.row, index > 0 ? styles.rowBorder : null]}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('Chat', { contact: item })}
    >
      <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
        <Text style={styles.avatarText}>{item.initials}</Text>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, item.unread ? styles.nameUnread : null]}>
            {item.name}
          </Text>
          <Text style={[styles.time, item.unread ? styles.timeUnread : null]}>
            {item.time}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, item.unread ? styles.previewUnread : null]}
            numberOfLines={1}
          >
            {item.preview}
          </Text>
          {item.unread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f ? styles.filterChipActive : null]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, activeFilter === f ? styles.filterTextActive : null]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conversation list */}
      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : hasError ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={handleRetry}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>Start a chat by messaging a seller on any listing.</Text>
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
    backgroundColor: COLORS.white,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: '#E4E4E4',
  },
  filterChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  rowContent: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  timeUnread: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    flex: 1,
  },
  previewUnread: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
    flexShrink: 0,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
