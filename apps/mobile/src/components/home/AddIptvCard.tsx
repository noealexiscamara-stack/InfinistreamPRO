import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, elevation, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';

const OPTIONS: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  href: '/add-source/xtream' | '/add-source/m3u-file' | '/add-source/m3u-url';
}> = [
  {
    icon: 'server-outline',
    iconColor: '#4EC4FF',
    title: 'Xtream Codes',
    subtitle: 'Serveur, identifiant et mot de passe',
    href: '/add-source/xtream',
  },
  {
    icon: 'folder-outline',
    iconColor: '#B57BFF',
    title: 'Playlist M3U',
    subtitle: 'Ajouter une playlist M3U / M3U8',
    href: '/add-source/m3u-file',
  },
  {
    icon: 'globe-outline',
    iconColor: '#33D17A',
    title: 'URL de playlist',
    subtitle: 'Ajouter une URL de playlist',
    href: '/add-source/m3u-url',
  },
];

export function AddIptvCard({ scale = 1 }: { scale?: number }) {
  return (
    <GlassCard style={[styles.card, elevation.cardSubtle, { padding: Math.round(spacing.lg * scale) }]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="link-outline" size={20} color={colors.cyan} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Ajouter votre IPTV</Text>
          <Text style={styles.lede}>Ajoutez votre source IPTV pour commencer à regarder</Text>
        </View>
      </View>

      <View style={styles.list}>
        {OPTIONS.map((option) => (
          <Pressable key={option.href} onPress={() => router.push(option.href)} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: `${option.iconColor}22` }]}>
              <Ionicons name={option.icon} size={18} color={option.iconColor} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{option.title}</Text>
              <Text style={styles.rowSub}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      <View style={styles.legal}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
        <Text style={styles.legalText}>
          Nous ne fournissons aucun contenu. Veuillez utiliser votre propre abonnement IPTV.
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, borderColor: colors.borderStrong, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 2 },
  kicker: { ...typography.label, color: colors.cyan },
  lede: { ...typography.caption, color: colors.textSecondary },
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  legal: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs },
  legalText: { ...typography.caption, color: colors.textTertiary, flex: 1, fontSize: 11, lineHeight: 15 },
});
