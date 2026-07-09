import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types';

// Shared navigation ref for code that needs to read navigation state without a
// screen's `navigation` prop — e.g. the notification-banner logic in MainScreen
// checking the current route so it can suppress a redundant banner while the
// user is already on the relevant Chat. Attached to NavigationContainer in App.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
