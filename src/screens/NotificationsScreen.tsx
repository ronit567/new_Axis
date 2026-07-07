import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps } from 'react';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import PressableScale from '../components/PressableScale';
import { haptics } from '../lib/haptics';
import { RootStackParamList, Notification, NotificationType } from '../types';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function iconForType(type: NotificationType): {
  icon: IoniconsName;
  iconBg: string;
  iconColor: string;
} {
  switch (type) {
    case 'message':
      return { icon: 'chatbubble-outline', iconBg: COLORS.primarySoft, iconColor: COLORS.primary };
    case 'listing_saved':
      return { icon: 'heart-outline', iconBg: '#FEE8E8', iconColor: COLORS.like };
  }
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function NotifItem({ item, onPress }: { item: Notification; onPress: () => void }) {
  const { icon, iconBg, iconColor } = iconForType(item.type);
  const unread = !item.read;
  return (
    <PressableScale
      style={[styles.item, unread ? styles.itemUnread : null]}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={item.message}
      accessibilityState={{ selected: unread }}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemText, unread ? styles.itemTextUnread : null]}>
          {item.message}
        </Text>
        <Text style={styles.itemTime}>{item.timeAgo}</Text>
      </View>
      {unread && <View style={styles.unreadDot} />}
    </PressableScale>
  );
}

export default function NotificationsScreen({ navigation }: Props) {
  const { data = [], isLoading, isError, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const todayNotifs = data.filter(n => isToday(n.createdAt));
  const earlierNotifs = data.filter(n => !isToday(n.createdAt));

  const handleNotifPress = (item: Notification) => {
    markRead.mutate(item.id);
    if (item.type === 'message' && item.actor && item.actorId) {
      navigation.navigate('Chat', {
        listingId: item.listingId,
        partnerId: item.actorId,
        partner: item.actor,
        listingTitle: item.listingTitle ?? undefined,
        listingPrice: item.listingPrice ?? undefined,
      });
    } else if (item.type === 'listing_saved' && item.listingId) {
      navigation.navigate('ListingDetail', { listingId: item.listingId });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          scaleTo={0.9}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.title}>Notifications</Text>
        <PressableScale
          onPress={() => {
            haptics.tap();
            markAll.mutate();
          }}
          scaleTo={0.94}
        >
          <Text style={styles.markAll}>Mark all read</Text>
        </PressableScale>
      </View>

      {isLoading ? (
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>TODAY</Text>
          {[0, 1].map(i => (
            <View key={i} style={styles.item}>
              <SkeletonLoader width={42} height={42} borderRadius={21} />
              <View style={styles.skeletonContent}>
                <SkeletonLoader width="90%" height={13} />
                <SkeletonLoader width="30%" height={11} />
              </View>
            </View>
          ))}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EARLIER</Text>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.item}>
              <SkeletonLoader width={42} height={42} borderRadius={21} />
              <View style={styles.skeletonContent}>
                <SkeletonLoader width="90%" height={13} />
                <SkeletonLoader width="30%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="You're all caught up! No new notifications right now."
          ctaLabel="Go to feed"
          onCta={() => navigation.navigate('Main')}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          {/* Today */}
          {todayNotifs.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>TODAY</Text>
              {todayNotifs.map(item => (
                <NotifItem key={item.id} item={item} onPress={() => handleNotifPress(item)} />
              ))}
            </>
          )}

          {/* Earlier */}
          {earlierNotifs.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: todayNotifs.length > 0 ? 20 : 0 }]}>
                EARLIER
              </Text>
              {earlierNotifs.map(item => (
                <NotifItem key={item.id} item={item} onPress={() => handleNotifPress(item)} />
              ))}
            </>
          )}
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  markAll: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: SIZES.borderRadiusSm,
    marginBottom: 4,
    gap: 12,
  },
  itemUnread: {
    backgroundColor: COLORS.primaryTint,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...SHADOWS.card,
  },
  itemContent: {
    flex: 1,
  },
  skeletonContent: {
    flex: 1,
    gap: 7,
  },
  itemText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  itemTextUnread: {
    color: COLORS.text,
    fontWeight: '500',
  },
  itemTime: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    flexShrink: 0,
  },
});
