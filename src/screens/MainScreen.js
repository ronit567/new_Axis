import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import BottomTabBar from '../components/BottomTabBar';
import HomeScreen from './HomeScreen';
import SavedScreen from './SavedScreen';
import MessagesScreen from './MessagesScreen';
import ProfileScreen from './ProfileScreen';

export default function MainScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Home');

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

  const handleTabPress = tab => {
    if (tab === 'Create') {
      navigation.navigate('CreateListing');
      return;
    }
    setActiveTab(tab);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderContent()}</View>
      <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FA',
  },
  content: {
    flex: 1,
  },
});
