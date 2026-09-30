import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureChannels, getPushToken, requestPermission } from './notifications';
import { savePushToken } from './api';

const TOKEN_KEY = 'push:token';

export type PushStatus =
  | 'checking'
  /** Registered — the opponent's ticks will reach this device. */
  | 'registered'
  /** The user said no to notifications. */
  | 'denied'
  /**
   * No token available. Expected on a simulator, and on any build without
   * Firebase credentials — Android delivers push through FCM, so a token
   * cannot exist without it. See "Push notifications" in the README.
   */
  | 'unavailable';

export function usePushRegistration(userId: string | null): PushStatus {
  const [status, setStatus] = useState<PushStatus>('checking');

  useEffect(() => {
    if (!userId) {
      setStatus('checking');
      return;
    }
    let alive = true;

    (async () => {
      try {
        await ensureChannels();

        if (!(await requestPermission())) {
          if (alive) setStatus('denied');
          return;
        }

        const token = await getPushToken();
        if (!token) {
          if (alive) setStatus('unavailable');
          return;
        }

        await savePushToken(userId, token, Platform.OS);
        await AsyncStorage.setItem(TOKEN_KEY, token);
        if (alive) setStatus('registered');
      } catch {
        if (alive) setStatus('unavailable');
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  return status;
}

/** The token this device registered, if any — used to unregister on sign-out. */
export async function storedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function forgetPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
