import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
// Type-only: erased at runtime, so it never pulls the native module in.
import type * as NotificationsModule from 'expo-notifications';

/** Android channel for opponent activity (ticks, finished days). */
export const EVENTS_CHANNEL = 'challenge-events';

/**
 * Whether expo-notifications can be touched at all.
 *
 * Expo Go dropped the native push module in SDK 53, and *importing*
 * expo-notifications there throws outright — it is not enough to avoid
 * calling it. Web has no implementation either. So the module is required
 * lazily, behind this gate, and every entry point below degrades to a no-op
 * when it is false. The app then runs normally in Expo Go, just silently.
 */
export const NOTIFICATIONS_SUPPORTED =
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let cached: typeof NotificationsModule | null = null;

/** The native module, or null when it cannot be loaded here. */
export function notifications(): typeof NotificationsModule | null {
  if (!NOTIFICATIONS_SUPPORTED) return null;
  if (!cached) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-notifications') as typeof NotificationsModule;
      cached.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      return null;
    }
  }
  return cached;
}

export async function ensureChannels(): Promise<void> {
  const N = notifications();
  if (!N || Platform.OS !== 'android') return;

  await N.setNotificationChannelAsync(EVENTS_CHANNEL, {
    name: 'Challenge activity',
    description: 'When your opponent ticks a task or finishes a day.',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#7C93FF',
  });

}

/** Asks once. Returns whether we may post notifications. */
export async function requestPermission(): Promise<boolean> {
  const N = notifications();
  if (!N || !Device.isDevice) return false;

  const existing = await N.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  return (await N.requestPermissionsAsync()).granted;
}

/**
 * The Expo push token for this device, or null.
 *
 * Null is an expected outcome, not a failure: Android push is delivered by
 * Firebase, so without google-services.json and an Expo project id there is
 * no token to get. See "Notifications" in the README.
 */
export async function getPushToken(): Promise<string | null> {
  const N = notifications();
  if (!N || !Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch {
    return null;
  }
}

export interface NotificationTap {
  challengeId?: string;
  dayNumber?: number | string;
}

/** Fires when the user taps a notification. No-op where unsupported. */
export function addNotificationTapListener(
  fn: (data: NotificationTap) => void
): () => void {
  const N = notifications();
  if (!N) return () => {};

  const sub = N.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationTap | undefined;
    if (data) fn(data);
  });
  return () => sub.remove();
}
