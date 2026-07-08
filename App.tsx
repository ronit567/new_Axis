import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans';
import { RootStackParamList } from './src/types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useCurrentProfile } from './src/hooks/useProfile';
import QueryProvider from './src/providers/QueryProvider';
import ActivitySpinner from './src/components/ActivitySpinner';
import ErrorState from './src/components/ErrorState';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
 * One navigator, three mutually exclusive groups, gated on session AND
 * profile existence (not session alone — see AX-301): a signed-in user with
 * no `profiles` row yet is routed to a mandatory SetupProfile step instead of
 * the main app. React Navigation animates each swap and resets the outgoing
 * group's state automatically, so there's no manual navigate/reset.
 */
function RootNavigator() {
  const { isSignedIn, loading } = useAuth();
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useCurrentProfile();

  // Gate here rather than in AuthProvider so the provider tree (and
  // NavigationContainer) stays mounted while the session/profile are loading.
  if (loading || (isSignedIn && profileLoading)) {
    return <ActivitySpinner size="large" style={{ flex: 1 }} />;
  }

  // A failed fetch leaves `profile` as `undefined`, not `null` — treat that
  // as "unknown" and show a retry, not as "no profile row" (which would
  // wrongly force an existing user back through onboarding on e.g. a network
  // blip). Only a successful fetch that actually found nothing (`null`)
  // means onboarding is needed.
  if (isSignedIn && profileError) {
    return (
      <ErrorState
        message="Couldn't load your profile. Check your connection and try again."
        onRetry={() => refetchProfile()}
      />
    );
  }

  const needsOnboarding = isSignedIn && profile === null;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {!isSignedIn ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        </Stack.Group>
      ) : needsOnboarding ? (
        <Stack.Group>
          <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ManageListings" component={ManageListingsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          {/* No stack animation at all: Home collapses its greeting row BEFORE
              navigating and Search mounts with pixel-identical header geometry,
              so the switch itself is invisible — Search then animates its own
              close button + results in. The whole transition is hand-rolled
              across the two screens instead of a card animation. */}
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ animation: 'none' }}
          />
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
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

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
