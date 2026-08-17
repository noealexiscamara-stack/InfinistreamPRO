import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function Index() {
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  return <Redirect href={onboardingComplete ? '/(tabs)/home' : '/onboarding'} />;
}
