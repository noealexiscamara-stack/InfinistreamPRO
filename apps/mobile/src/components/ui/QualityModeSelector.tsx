import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QualityMode } from '@infiny-stream/types';
import { QUALITY_MODE_LABELS } from '@infiny-stream/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const MODES: QualityMode[] = ['auto', 'economy', 'balanced', 'quality'];

const DESCRIPTIONS: Record<QualityMode, string> = {
  auto: 'Le lecteur adapte la qualité à la connexion (ABR ExoPlayer). Tampon standard.',
  economy: 'Tampon plus court — démarrage plus rapide, moins de mémoire réservée.',
  balanced: 'Tampon intermédiaire — compromis entre démarrage et marge anti-coupure.',
  quality: 'Tampon plus large — plus de stabilité sur réseau instable, démarrage un peu plus long.',
};

export function QualityModeSelector({ value, onChange }: { value: QualityMode; onChange: (mode: QualityMode) => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.pills}>
        {MODES.map((mode) => {
          const selected = mode === value;
          return (
            <Pressable key={mode} onPress={() => onChange(mode)} style={[styles.pill, selected && styles.pillSelected]}>
              <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]}>{QUALITY_MODE_LABELS[mode]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.description}>{DESCRIPTIONS[value]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  pillLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  pillLabelSelected: { color: colors.textPrimary },
  description: { ...typography.caption, color: colors.textTertiary },
});
