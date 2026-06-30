import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

const TODAY_NOTIFICATIONS = [
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
    iconBg: '#EEE8F8',
    iconColor: COLORS.primary,
    message: 'Maya P. replied about your Organic Chem textbook',
    time: '1h ago',
    unread: true,
  },
];

const EARLIER_NOTIFICATIONS = [
  {
    id: 'n3',
    type: 'price_drop',
    icon: 'trending-down-outline',
    iconBg: '#E8F5E9',
    iconColor: COLORS.westernGreen,
    message: 'Price dropped to $25 on "Desk chair" you saved!',
    time: '1d ago',
    unread: false,
  },
  {
    id: 'n4',
    type: 'verified',
    icon: 'checkmark-circle-outline',
    iconBg: '#E8F5E9',
    iconColor: COLORS.westernGreen,
    message: "You're now Western verified — your badge is live",
    time: '2d ago',
    unread: false,
  },
  {
    id: 'n5',
    type: 'saves',
    icon: 'heart-outline',
    iconBg: '#FEE8E8',
    iconColor: '#E63946',
    message: '3 people saved your Organic Chem listing',
    time: '6d ago',
    unread: false,
  },
];

function NotifItem({ item, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.item, item.unread ? styles.itemUnread : null]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={20} color={item.iconColor} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemText, item.unread ? styles.itemTextUnread : null]}>
          {item.message}
        </Text>
        <Text style={styles.itemTime}>{item.time}</Text>
      </View>
      {item.unread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const CHAT_CONTACT = { initials: 'AK', name: 'Aria K.', avatarColor: '#5C2D91' };

export default function NotificationsScreen({ navigation }) {
  const [todayNotifs, setTodayNotifs] = useState(TODAY_NOTIFICATIONS);
  const [earlierNotifs, setEarlierNotifs] = useState(EARLIER_NOTIFICATIONS);

  const markAllRead = () => {
    setTodayNotifs(prev => prev.map(n => ({ ...n, unread: false })));
    setEarlierNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleNotifPress = item => {
    if (item.type === 'offer' || item.type === 'reply') {
      navigation.navigate('Chat', { contact: CHAT_CONTACT });
    } else if (item.type === 'price_drop' || item.type === 'saves') {
      navigation.navigate('Main');
    } else if (item.type === 'verified') {
      navigation.navigate('Settings');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  title: {
    flex: 1,
    fontSize: SIZES.lg,
    fontWeight: '700',
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
    fontWeight: '700',
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
    backgroundColor: '#FAF7FF',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: {
    flex: 1,
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
