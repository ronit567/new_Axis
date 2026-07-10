import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import { useConversations } from '../hooks/useMessages';
import { Conversation, RootStackParamList } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const FILTERS = ['All', 'Buying', 'Selling'];

export default function MessagesScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState('All');
  const { data, isPending, isError, refetch } = useConversations();

  // Spinner only for user-initiated pulls — background refetches from realtime
  // invalidation must not replay the pull-to-refresh animation.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const conversations = data ?? [];
  const filtered =
    activeFilter === 'All'
      ? conversations
      : conversations.filter(c => c.type === activeFilter);

  const renderItem = ({ item, index }: { item: Conversation; index: number }) => (
    <TouchableOpacity
      style={[styles.row, index > 0 ? styles.rowBorder : null]}
      activeOpacity={0.75}
      onPress={() =>
        navigation.navigate('Chat', {
          listingId: item.listingId,
          partnerId: item.partnerId,
          partner: item.partner,
          listingTitle: item.listingTitle ?? undefined,
          listingPrice: item.listingPrice ?? undefined,
        })
      }
    >
      <Avatar
        url={item.partner.avatarUrl}
        initials={item.partner.initials}
        color={item.partner.avatarColor}
        size={48}
        style={styles.avatar}
        textStyle={styles.avatarText}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, item.unreadCount > 0 ? styles.nameUnread : null]}>
            {item.partner.name}
          </Text>
          <Text style={[styles.time, item.unreadCount > 0 ? styles.timeUnread : null]}>
            {item.lastMessageAt}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, item.unreadCount > 0 ? styles.previewUnread : null]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 9 ? '9+' : item.unreadCount}
              </Text>
            </View>
          )}
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
      {isPending ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.row, i > 0 ? styles.rowBorder : null]}>
              <SkeletonLoader
                width={48}
                height={48}
                borderRadius={24}
                style={styles.skeletonAvatar}
              />
              <View style={styles.skeletonRowContent}>
                <SkeletonLoader width="45%" height={14} />
                <SkeletonLoader width="75%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => `${item.listingId ?? 'none'}|${item.partnerId}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            conversations.length > 0 ? (
              // Threads exist, just none under this filter — don't imply an
              // empty inbox.
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title={`No ${activeFilter.toLowerCase()} conversations yet.`}
                ctaLabel="Show all"
                onCta={() => setActiveFilter('All')}
              />
            ) : (
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="No conversations yet. Start a chat by messaging a seller on any listing."
                ctaLabel="Browse listings"
                onCta={() => navigation.navigate('Main')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
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
    fontFamily: FONTS.extraBold,
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
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
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
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  unreadBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
  skeletonAvatar: {
    marginRight: 14,
  },
  skeletonRowContent: {
    flex: 1,
    gap: 8,
  },
});
