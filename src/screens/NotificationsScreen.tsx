import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const TODAY_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'offer',
    icon: 'cash-outline',
    iconBg: COLORS.primary,
    iconColor: COLORS.white,
    message: 'Aria K. sent you an offer — $260 on iPad Air',
    time: '3h ago',
    unread: true,
  },
  {
    id: 'n2',
    type: 'reply',
    icon: 'chatbubble-outline',
    iconBg: COLORS.primarySoft,
    iconColor: COLORS.primary,
    message: 'Maya P. replied about your Organic Chem textbook',
    time: '1h ago',
    unread: true,
  },
];

const EARLIER_NOTIFICATIONS: Notification[] = [
  {
    id: 'n3',
    type: 'price_drop',
    icon: 'trending-down-outline',
    iconBg: COLORS.successSoft,
    iconColor: COLORS.westernGreen,
    message: 'Price dropped to $25 on "Desk chair" you saved!',
    time: '1d ago',
    unread: false,
  },
  {
    id: 'n5',
    type: 'saves',
    icon: 'heart-outline',
    iconBg: '#FEE8E8',
    iconColor: COLORS.like,
    message: '3 people saved your Organic Chem listing',
    time: '6d ago',
    unread: false,
  },
];

type Notification = {
  id: string;
  type: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  message: string;
  time: string;
  unread: boolean;
};

function NotifItem({ item, onPress }: { item: Notification; onPress: () => void }) {
  return (
    <PressableScale
      style={[styles.item, item.unread ? styles.itemUnread : null]}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={item.message}
      accessibilityState={{ selected: item.unread }}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon as IoniconsName} size={20} color={item.iconColor} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemText, item.unread ? styles.itemTextUnread : null]}>
          {item.message}
        </Text>
        <Text style={styles.itemTime}>{item.time}</Text>
      </View>
      {item.unread && <View style={styles.unreadDot} />}
    </PressableScale>
  );
}

const CHAT_CONTACT = { initials: 'AK', name: 'Aria K.', avatarColor: COLORS.primary };

export default function NotificationsScreen({ navigation }: Props) {
  const [todayNotifs, setTodayNotifs] = useState(TODAY_NOTIFICATIONS);
  const [earlierNotifs, setEarlierNotifs] = useState(EARLIER_NOTIFICATIONS);
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

  const markAllRead = () => {
    setTodayNotifs(prev => prev.map(n => ({ ...n, unread: false })));
    setEarlierNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleNotifPress = (item: Notification) => {
    if (item.type === 'offer' || item.type === 'reply') {
      navigation.navigate('Chat', { contact: CHAT_CONTACT });
    } else if (item.type === 'price_drop' || item.type === 'saves') {
      navigation.navigate('Main');
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
            markAllRead();
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
      ) : hasError ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={handleRetry}
        />
      ) : todayNotifs.length === 0 && earlierNotifs.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="You're all caught up! No new notifications right now."
          ctaLabel="Go to feed"
          onCta={() => navigation.navigate('Main')}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Today */}
          <Text style={styles.sectionLabel}>TODAY</Text>
          {todayNotifs.map(item => (
            <NotifItem key={item.id} item={item} onPress={() => handleNotifPress(item)} />
          ))}

          {/* Earlier */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EARLIER</Text>
          {earlierNotifs.map(item => (
            <NotifItem key={item.id} item={item} onPress={() => handleNotifPress(item)} />
          ))}
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
