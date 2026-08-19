import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { APP_NAME } from '@infiny-stream/config';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { QualityModeSelector } from '@/components/ui/QualityModeSelector';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getBuildGitShaShort } from '@/utils/buildInfo';

function Row({ icon, label, meta, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; meta?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View style={styles.row}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} style={styles.rowIcon} />
        <Text style={styles.rowLabel}>{label}</Text>
        {!!meta && <Text style={styles.rowMeta}>{meta}</Text>}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const qualityMode = useSettingsStore((s) => s.qualityMode);
  const setQualityMode = useSettingsStore((s) => s.setQualityMode);
  const lowBandwidthMode = useSettingsStore((s) => s.lowBandwidthMode);
  const setLowBandwidthMode = useSettingsStore((s) => s.setLowBandwidthMode);

  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Réglages</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qualité de lecture</Text>
          <GlassCard>
            <QualityModeSelector value={qualityMode} onChange={setQualityMode} />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réseau</Text>
          <GlassCard style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Mode connexion faible</Text>
              <Text style={styles.rowMeta}>Réduit les animations et privilégie la stabilité.</Text>
            </View>
            <Switch
              value={lowBandwidthMode}
              onValueChange={setLowBandwidthMode}
              trackColor={{ true: colors.brand, false: colors.border }}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contenu</Text>
          <GlassCard padded={false}>
            <Row icon="albums-outline" label="Mes playlists" onPress={() => router.push('/playlists')} />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <GlassCard padded={false}>
            <Row icon="person-outline" label="Mon compte" onPress={() => router.push('/account')} />
            <Row icon="star-outline" label="Abonnement Premium" onPress={() => router.push('/subscription')} />
          </GlassCard>
        </View>

        <Text style={styles.footer}>
          {APP_NAME} · v{version}
        </Text>
        <Text style={styles.buildSha}>build {getBuildGitShaShort()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  title: { ...typography.title, color: colors.textPrimary },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  rowIcon: { width: 22 },
  rowLabel: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  rowMeta: { ...typography.caption, color: colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footer: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.lg },
  buildSha: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    opacity: 0.75,
  },
});
