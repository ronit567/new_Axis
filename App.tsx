import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './src/types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import QueryProvider from './src/providers/QueryProvider';
import ActivitySpinner from './src/components/ActivitySpinner';

// ── Signed-out: auth & onboarding ──
import WelcomeScreen from './src/screens/WelcomeScreen';
import SignInScreen from './src/screens/SignInScreen';
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import SetupProfileScreen from './src/screens/SetupProfileScreen';

// ── Signed-in: the app ──
import MainScreen from './src/screens/MainScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ManageListingsScreen from './src/screens/ManageListingsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SearchScreen from './src/screens/SearchScreen';
import ListingDetailScreen from './src/screens/ListingDetailScreen';
import SellerProfileScreen from './src/screens/SellerProfileScreen';
import CreateListingScreen from './src/screens/CreateListingScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import CommunityGuidelinesScreen from './src/screens/CommunityGuidelinesScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * One navigator, two mutually exclusive groups. The `isSignedIn` flag decides
 * which group is mounted — React Navigation animates the swap and resets the
 * other group's state automatically, so there's no manual navigate/reset.
 */
function RootNavigator() {
  const { isSignedIn, loading } = useAuth();

  // Gate here rather than in AuthProvider so the provider tree (and
  // NavigationContainer) stays mounted while the session is being restored.
  if (loading) {
    return <ActivitySpinner size="large" style={{ flex: 1 }} />;
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {isSignedIn ? (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ManageListings" component={ManageListingsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
          <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
          <Stack.Screen
            name="CreateListing"
            component={CreateListingScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
          <Stack.Screen
            name="CommunityGuidelines"
            component={CommunityGuidelinesScreen}
          />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
