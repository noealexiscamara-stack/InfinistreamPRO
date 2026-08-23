import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

/** Stack-only shell — no bottom tab bar (header + quick tiles own navigation). */
export default function MainStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="search" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="favorites" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
