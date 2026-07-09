import React, { useState, type ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import BottomTabBar, { TabName } from '../components/BottomTabBar';
import { COLORS } from '../constants/theme';
import HomeScreen from './HomeScreen';
import SavedScreen from './SavedScreen';
import MessagesScreen from './MessagesScreen';
import ProfileScreen from './ProfileScreen';
import { RootStackParamList } from '../types';
import type { NotificationRow } from '../types/database';
import { useConversations, useMessagesRealtime } from '../hooks/useMessages';
import { useNotificationsRealtime } from '../hooks/useNotifications';
import { useNotificationBanner, type BannerContent } from '../context/NotificationBannerContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

// Realtime rows carry only ids (actor/listing), not the joined names the list
// query resolves — so the banner copy is derived from the notification type.
// Unknown/future types still surface a sensible generic banner.
function bannerForNotification(
  row: NotificationRow,
): Pick<BannerContent, 'title' | 'body' | 'icon'> {
  const icon = (name: ComponentProps<typeof Ionicons>['name']) => name;
  switch (row.type) {
    case 'message':
      return { title: 'New message', body: 'You have a new message', icon: icon('chatbubble-ellipses') };
    case 'listing_saved':
      return { title: 'Listing saved', body: 'Someone saved your listing', icon: icon('heart') };
    default:
      return { title: 'New notification', body: 'You have new activity', icon: icon('notifications') };
  }
}

export default function MainScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const banner = useNotificationBanner();
  // Lives here (not in a chat screen) so incoming messages land in the cache
  // for the whole signed-in session, keeping the inbox fresh in the background.
  useMessagesRealtime();
  // Same placement rationale: keeps the Home bell dot and the notifications
  // list live for the whole signed-in session. The callback surfaces each new
  // notification as a foreground banner (tap → open the Notifications list).
  useNotificationsRealtime((row) => {
    banner.show({
      ...bannerForNotification(row),
      onPress: () => navigation.navigate('Notifications'),
    });
  });
  // Same cache MessagesScreen reads; the realtime hook above invalidates it on
  // every INSERT/UPDATE, so the tab badge tracks conversations with unread
  // across the session.
  const { data: conversations } = useConversations();
  const unreadTotal = (conversations ?? []).filter((c) => c.unreadCount > 0).length;

  const renderContent = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen navigation={navigation} />;
      case 'Saved':
        return <SavedScreen navigation={navigation} />;
      case 'Messages':
        return <MessagesScreen navigation={navigation} />;
      case 'Profile':
        return <ProfileScreen navigation={navigation} />;
      default:
        return <HomeScreen navigation={navigation} />;
    }
  };

  const handleTabPress = (tab: TabName) => {
    if (tab === 'Create') {
      navigation.navigate('CreateListing');
      return;
    }
    setActiveTab(tab);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderContent()}</View>
      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} messagesBadge={unreadTotal} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  content: {
    flex: 1,
  },
});
