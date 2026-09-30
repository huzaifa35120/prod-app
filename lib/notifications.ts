import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

/** Android channel for opponent activity (ticks, finished days). */
export const EVENTS_CHANNEL = 'challenge-events';
/** Android channel for the ongoing timer. Silent — it must not buzz every tick. */
export const TIMER_CHANNEL = 'focus-timer';

// How a notification behaves when it lands while the app is open.
// Skipped on web, where expo-notifications has no implementation.
if (Platform.OS !== 'web')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(EVENTS_CHANNEL, {
    name: 'Challenge activity',
    description: 'When your opponent ticks a task or finishes a day.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#7C93FF',
  });

  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
    name: 'Productivity timer',
    description: 'The running timer, so you can pause or log it from the shade.',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: [0],
    enableVibrate: false,
    showBadge: false,
  });
}

/** Asks once. Returns whether we may post notifications. */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * The Expo push token for this device, or null.
 *
 * Null is an expected outcome, not a failure: Android push is delivered by
 * Firebase, so without google-services.json and an Expo project id there is
 * no token to get. The app falls back to local notifications driven by the
 * realtime subscription — see lib/useOpponentAlerts.ts.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch {
    // No FCM credentials on the build, or offline. Local notifications still work.
    return null;
  }
}
