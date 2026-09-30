import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Imported per weight, not from the package root: the root index re-exports
// every weight and italic, and Metro cannot tree-shake asset requires — so a
// bare import ships ~40 unused font files.
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { AuthProvider, useAuth } from '../lib/auth';
import { usePushRegistration } from '../lib/usePushRegistration';
import { addNotificationTapListener } from '../lib/notifications';
import { registerTimerNotificationHandlers } from '../lib/timerNotification';
import { isSupabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';
import { Loading } from '../components/ui';
import SetupNotice from '../components/SetupNotice';

// Hold the splash until the fonts are in memory, so nothing renders unstyled.
void SplashScreen.preventAutoHideAsync();

// Module scope on purpose: the timer notification's buttons must work even
// when the app is not running, and the handler has to be registered before
// the headless task starts.
registerTimerNotificationHandlers();

function RootNavigator() {
  const { session, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  usePushRegistration(session?.user?.id ?? null);

  // Tapping a push about the opponent opens the day it refers to.
  useEffect(
    () =>
      addNotificationTapListener((data) => {
        if (!data.challengeId) return;
        router.push(
          data.dayNumber != null
            ? `/challenge/${data.challengeId}/day/${data.dayNumber}`
            : `/challenge/${data.challengeId}`
        );
      }),
    [router]
  );

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, initializing, segments, router]);

  if (initializing) return <Loading label="Loading your challenges…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 15 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="challenge/new"
        options={{ title: 'New challenge', presentation: 'modal' }}
      />
      <Stack.Screen name="challenge/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="challenge/[id]/day/[dayNumber]" options={{ title: '' }} />
      <Stack.Screen name="join/[code]" options={{ title: '' }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  const onReady = useCallback(async () => {
    if (fontsLoaded || fontError) await SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Render nothing until the fonts resolve; `fontError` still lets the app
  // through on system fonts rather than hanging on the splash forever.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onReady}>
          <StatusBar style="light" />
          {isSupabaseConfigured ? (
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          ) : (
            <SetupNotice />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
