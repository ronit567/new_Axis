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
import { navigationRef } from './src/lib/navigation';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationBannerProvider } from './src/context/NotificationBannerContext';
import { useCurrentProfile } from './src/hooks/useProfile';
import { useReducedMotion } from './src/hooks/useReducedMotion';
import QueryProvider from './src/providers/QueryProvider';
import ActivitySpinner from './src/components/ActivitySpinner';
import ErrorState from './src/components/ErrorState';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initCrashReporting } from './src/lib/sentry';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Before anything renders, so a throw during the first mount is still reported.
initCrashReporting();

// ── Signed-out: auth & onboarding ──
import WelcomeScreen from './src/screens/WelcomeScreen';
import SignInScreen from './src/screens/SignInScreen';
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
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
import EditListingScreen from './src/screens/EditListingScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
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
  const reducedMotion = useReducedMotion();
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

  // Full-screen slides are the largest motion in the app, so Reduce Motion
  // swaps every push for a cross-fade. Screens that already choreograph their
  // own entrance keep their explicit option below — `none` is nothing to
  // reduce, and the two bottom-sheet routes fade rather than travel.
  const pushAnimation = reducedMotion ? 'fade' : 'slide_from_right';
  const sheetAnimation = reducedMotion ? 'fade' : 'slide_from_bottom';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: pushAnimation }}
    >
      {!isSignedIn ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          {/* Also registered in the signed-in group below. CreateAccount asks
              users to agree to these before an account exists, so they have to
              be reachable from here too — consenting to a document you cannot
              open isn't consent, and App Review checks for it. Duplicate names
              across groups are fine: only one group is ever mounted. */}
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
          <Stack.Screen
            name="CommunityGuidelines"
            component={CommunityGuidelinesScreen}
          />
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
          {/* No stack animation at all: Search mounts with header geometry
              pixel-identical to Home (greeting expanded, full-width bar, no
              side buttons), so the switch itself is invisible. Search then
              runs the whole entrance on one timeline — greeting collapses up
              while the back/filter buttons grow in and the results fade up. */}
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
          <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
          {/* 250ms (vs the platform default) keeps the compose slide snappy —
              CreateListing's is timed to play right after the circle-expand
              reveal MainScreen runs from the + button. */}
          <Stack.Screen
            name="CreateListing"
            component={CreateListingScreen}
            options={{ animation: sheetAnimation, animationDuration: 250 }}
          />
          <Stack.Screen
            name="EditListing"
            component={EditListingScreen}
            options={{ animation: sheetAnimation, animationDuration: 250 }}
          />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
          {/* Also registered in the signed-out group: Settings' "Change
              password" reuses the same email-code reset flow while a session
              exists (ResetPassword handles both cases — see its success
              branch). */}
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
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
    // Outermost, above the providers: a throw inside AuthProvider or
    // QueryProvider is exactly the kind that white-screens the app, and a
    // boundary nested under them would go down with the tree it was meant to
    // catch. SafeAreaProvider is the one thing the fallback needs, so the
    // boundary's own SafeAreaView uses the platform inset directly.
    <ErrorBoundary>
      <AuthProvider>
        <QueryProvider>
          <SafeAreaProvider>
            <NotificationBannerProvider>
              <NavigationContainer ref={navigationRef}>
                <RootNavigator />
              </NavigationContainer>
            </NotificationBannerProvider>
          </SafeAreaProvider>
        </QueryProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
