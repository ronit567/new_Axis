import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import BottomTabBar, { TabName } from '../components/BottomTabBar';
import { COLORS } from '../constants/theme';
import HomeScreen from './HomeScreen';
import SavedScreen from './SavedScreen';
import MessagesScreen from './MessagesScreen';
import ProfileScreen from './ProfileScreen';
import { RootStackParamList } from '../types';
import { useConversations, useMessagesRealtime } from '../hooks/useMessages';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

export default function MainScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  // Lives here (not in a chat screen) so incoming messages land in the cache
  // for the whole signed-in session, keeping the inbox fresh in the background.
  useMessagesRealtime();
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
