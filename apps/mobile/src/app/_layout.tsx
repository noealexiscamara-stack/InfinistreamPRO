import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/theme/tokens';
import { getDatabase } from '@/utils/db';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useNetworkMonitorBootstrap } from '@/store/useNetworkStore';
import { useAuthStore, handleUnauthorizedSession } from '@/store/useAuthStore';
import { useConfigStore } from '@/store/useConfigStore';
import { setUnauthorizedHandler } from '@/services/api/unauthorizedHandler';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op: fine if it was already hidden */
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  useNetworkMonitorBootstrap();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void handleUnauthorizedSession().finally(() => {
        router.replace('/login');
      });
    });
  }, []);

  const bootstrap = useCallback(async () => {
    await getDatabase();
    await Promise.all([
      useSourcesStore.getState().load(),
      useFavoritesStore.getState().load(),
      useHistoryStore.getState().load(),
      useConfigStore.getState().refresh(),
      useAuthStore.getState().hydrate(),
    ]);
    setIsReady(true);
  }, []);

  useEffect(() => {
    bootstrap().finally(() => SplashScreen.hideAsync().catch(() => undefined));
  }, [bootstrap]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player/[channelId]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="add-source/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-source/m3u-url" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-source/m3u-file" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-source/xtream" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
