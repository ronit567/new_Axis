import { Alert, Linking } from 'react-native';
import { SUPPORT_EMAIL } from '../constants/contact';

// mailto: can fail on a device with no configured mail client — fall back to
// showing the address so the user can reach us from anywhere.
export function openSupportEmail(subject: string) {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('Email us', `Reach our team at ${SUPPORT_EMAIL}`);
  });
}
