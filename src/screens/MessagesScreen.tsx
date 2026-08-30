import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { FLOATING_TAB_BAR_CLEARANCE } from '../components/BottomTabBar';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import CategoryChip from '../components/CategoryChip';
import Screen from '../components/layout/Screen';
import ScreenHeader from '../components/layout/ScreenHeader';
import { haptics } from '../lib/haptics';
import { useConversations } from '../hooks/useMessages';
import { Conversation, RootStackParamList } from '../types';

type Props = {
  navigation: NavigationProp<RootStackParamList>;
  /**
   * Switches the parent tab container to Home. Required because MainScreen
   * owns the active tab in local state, not navigation state — so this screen
   * can't reach Home with a `navigate` call: it is already rendered *inside*
   * the `Main` route, and navigating there is a no-op. Optional so the screen
   * still works if it's ever pushed as a standalone `Messages` stack route,
   * where falling back to `navigate('Main')` is the correct behaviour.
   */
  onBrowseListings?: () => void;
};

const FILTERS = ['All', 'Buying', 'Selling'];

export default function MessagesScreen({ navigation, onBrowseListings }: Props) {
  const [activeFilter, setActiveFilter] = useState('All');
  const { data, isPending, isError, refetch } = useConversations();

  // Hairline + shadow under the fixed header/filters, faded in on scroll so the
  // header looks flush at rest and gains definition as content passes under it.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [0, 14],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

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

  const keyExtractor = useCallback(
    (item: Conversation) => `${item.listingId ?? 'none'}|${item.partnerId}`,
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Conversation; index: number }) => (
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
    ),
    [navigation],
  );

  return (
    <Screen>
      {/* Fixed header block (title + filters) with a scroll hairline pinned to
          its bottom edge — below the filters, not below the title, so the
          whole block reads as one surface the list slides under. */}
      <View style={styles.headerBlock}>
        {/* No `trailing` action: the search icon here was wired to a no-op,
            so it looked tappable and did nothing. Restore it alongside real
            conversation search rather than shipping a dead control. */}
        <ScreenHeader variant="large" title="Messages" />

        {/* Filters — the same chip the Home categories use, so a pill means
            the same thing and animates the same way on both screens. */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <CategoryChip
              key={f}
              label={f}
              active={activeFilter === f}
              onPress={() => {
                haptics.tap();
                setActiveFilter(f);
              }}
            />
          ))}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.scrollHairline, { opacity: headerBorderOpacity }]}
        />
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
        <Animated.FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
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
                onCta={() =>
                  onBrowseListings ? onBrowseListings() : navigation.navigate('Main')
                }
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    position: 'relative',
    zIndex: 1,
  },
  scrollHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    ...SHADOWS.card,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
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
