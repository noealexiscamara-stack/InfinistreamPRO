import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';
import { StartupFailureScreen } from '@/components/startup/StartupFailureScreen';
import { deleteLocalDatabase, getDatabase, resetDatabaseConnection } from '@/utils/db';
import { useSourcesStore } from '@/store/useSourcesStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useNetworkMonitorBootstrap } from '@/store/useNetworkStore';
import { useAuthStore, handleUnauthorizedSession } from '@/store/useAuthStore';
import { useConfigStore } from '@/store/useConfigStore';
import { useParentalStore } from '@/store/useParentalStore';
import { setUnauthorizedHandler } from '@/services/api/unauthorizedHandler';
import { RadioPlaybackProvider } from '@/services/playback/RadioPlaybackProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op: fine if it was already hidden */
});

export class BootstrapError extends Error {
  readonly step: string;

  constructor(step: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'BootstrapError';
    this.step = step;
    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}

interface BootFailure {
  step: string;
  message: string;
}

type BootPhase = 'booting' | 'ready' | 'failed';

async function runBootStep<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new BootstrapError(step, message, cause);
  }
}

async function bootstrapApp(): Promise<void> {
  await runBootStep('Base de données locale', () => getDatabase());
  await Promise.all([
    runBootStep('Playlists', () => useSourcesStore.getState().load()),
    runBootStep('Favoris', () => useFavoritesStore.getState().load()),
    runBootStep('Historique', () => useHistoryStore.getState().load()),
    runBootStep('Configuration', () => useConfigStore.getState().refresh()),
    runBootStep('Session', () => useAuthStore.getState().hydrate()),
    runBootStep('Contrôle parental', () => useParentalStore.getState().hydrate()),
  ]);
}

function failureFromError(error: unknown, fallbackStep = 'Inconnue'): BootFailure {
  if (error instanceof BootstrapError) {
    return { step: error.step, message: error.message };
  }
  if (error instanceof Error) {
    return { step: fallbackStep, message: error.message };
  }
  return { step: fallbackStep, message: String(error) };
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [isResetting, setIsResetting] = useState(false);
  const failure = failureFromError(error, 'Affichage');

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await deleteLocalDatabase();
      retry();
    } catch (resetError) {
      console.error('Failed to reset local database from ErrorBoundary', resetError);
    } finally {
      setIsResetting(false);
    }
  }, [retry]);

  return (
    <StartupFailureScreen
      step={failure.step}
      message={failure.message}
      onRetry={retry}
      onReset={() => void handleReset()}
      isRetrying={isResetting}
    />
  );
}

export default function RootLayout() {
  const [phase, setPhase] = useState<BootPhase>('booting');
  const [failure, setFailure] = useState<BootFailure | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  useNetworkMonitorBootstrap();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void handleUnauthorizedSession().finally(() => {
        router.replace('/login');
      });
    });
  }, []);

  const startBootstrap = useCallback(async () => {
    setPhase('booting');
    setFailure(null);
    try {
      await bootstrapApp();
      setPhase('ready');
    } catch (error) {
      console.error('Bootstrap failed', error);
      setFailure(failureFromError(error));
      setPhase('failed');
    }
  }, []);

  useEffect(() => {
    void startBootstrap();
  }, [startBootstrap]);

  useEffect(() => {
    if (phase === 'ready' || phase === 'failed') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [phase]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    resetDatabaseConnection();
    try {
      await startBootstrap();
    } finally {
      setIsRetrying(false);
    }
  }, [startBootstrap]);

  const handleReset = useCallback(async () => {
    setIsRetrying(true);
    try {
      await deleteLocalDatabase();
      await startBootstrap();
    } catch (error) {
      console.error('Local database reset failed', error);
      setFailure(failureFromError(error, 'Réinitialisation'));
      setPhase('failed');
    } finally {
      setIsRetrying(false);
    }
  }, [startBootstrap]);

  if (phase === 'failed' && failure) {
    return (
      <StartupFailureScreen
        step={failure.step}
        message={failure.message}
        onRetry={() => void handleRetry()}
        onReset={() => void handleReset()}
        isRetrying={isRetrying}
      />
    );
  }

  if (phase !== 'ready') {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <RadioPlaybackProvider>
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
          <Stack.Screen name="universe/live" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="universe/movies" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="universe/radios" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="universe/series/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="universe/series/[seriesId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="player/[channelId]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="diagnostics/playback" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/parental" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="add-source/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add-source/m3u-url" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add-source/m3u-file" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add-source/xtream" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="playlists/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="playlists/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="account/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="subscription/index" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </RadioPlaybackProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
