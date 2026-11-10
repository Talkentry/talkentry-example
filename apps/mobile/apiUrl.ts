import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * On a physical phone, localhost / 10.0.2.2 point at the phone itself.
 * Reuse the same LAN host Expo Metro already uses (from the QR / exp:// URL).
 */
export const resolveTalkentryApiUrl = (): string => {
  const lanHost =
    Constants.expoConfig?.hostUri?.split(':')[0] ??
    (Constants.expoGoConfig as { debuggerHost?: string } | null)?.debuggerHost?.split(':')[0];

  const host = lanHost ?? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

  return `http://${host}:3087`;
};
