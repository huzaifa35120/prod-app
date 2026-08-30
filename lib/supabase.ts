import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until .env is filled in — screens use this to show setup help. */
export const isSupabaseConfigured =
  Boolean(url && anonKey && !url.includes('YOUR-PROJECT') && !anonKey.includes('YOUR-ANON-KEY'));

if (!isSupabaseConfigured) {
  console.warn(
    '[challenge-app] Supabase is not configured. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with `npx expo start -c`.'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      // On web, `window.localStorage` is used automatically.
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Only refresh tokens while the app is actually in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Turns a Supabase/Postgres error into something worth showing a user. */
export function errorMessage(error: unknown): string {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  const e = error as { message?: string; error_description?: string; details?: string };
  return e.message || e.error_description || e.details || 'Something went wrong.';
}
