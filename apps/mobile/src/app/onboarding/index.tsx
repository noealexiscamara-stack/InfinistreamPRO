import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { APP_NAME, APP_TAGLINE } from '@infiny-stream/config';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { useSettingsStore } from '@/store/useSettingsStore';

const STEPS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; description: string }> = [
  {
    icon: 'add-circle-outline',
    title: 'Ajoutez votre playlist',
    description: 'Une playlist M3U, un fichier, ou vos identifiants Xtream Codes — Infiny Stream lit vos propres sources.',
  },
  {
    icon: 'pulse-outline',
    title: 'Infiny Stream analyse votre connexion',
    description: "Pas de jargon technique : juste l'essentiel, en temps réel, pendant que vous regardez.",
  },
  {
    icon: 'play-circle-outline',
    title: 'Regardez avec la meilleure qualité disponible',
    description: "L'application s'adapte automatiquement, même sur une connexion faible.",
  },
];

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const isLastStep = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  function handleNext() {
    if (isLastStep) {
      completeOnboarding();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function goToAddSource() {
    completeOnboarding();
    router.replace('/add-source');
  }

  return (
    <LinearGradient colors={[colors.background, '#131726']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brand}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name={step.icon} size={48} color={colors.brand} />
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </View>

        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          <Button label={isLastStep ? 'Ajouter une source' : 'Suivant'} onPress={isLastStep ? goToAddSource : handleNext} />
          {isLastStep && <Button label="Plus tard" variant="ghost" onPress={completeOnboarding} />}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between', paddingVertical: spacing.xl },
  brand: { alignItems: 'center', marginTop: spacing.lg },
  appName: { ...typography.title, color: colors.textPrimary },
  tagline: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  hero: { alignItems: 'center', gap: spacing.md, flex: 1, justifyContent: 'center' },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: spacing.lg },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.brand, width: 20 },
  actions: { gap: spacing.sm },
});
