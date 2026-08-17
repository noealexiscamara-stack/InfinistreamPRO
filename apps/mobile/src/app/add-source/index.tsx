import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';

const OPTIONS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; description: string; href: '/add-source/m3u-url' | '/add-source/m3u-file' | '/add-source/xtream' }> = [
  { icon: 'link-outline', title: 'URL M3U', description: 'Ajoutez une playlist à partir d’un lien http(s)://...', href: '/add-source/m3u-url' },
  { icon: 'document-outline', title: 'Fichier M3U', description: 'Importez un fichier .m3u ou .m3u8 depuis votre appareil.', href: '/add-source/m3u-file' },
  { icon: 'server-outline', title: 'Connexion Xtream', description: 'Serveur, identifiant et mot de passe Xtream Codes.', href: '/add-source/xtream' },
];

export default function AddSourceScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajouter une playlist</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <Pressable key={option.href} onPress={() => router.push(option.href)}>
            <GlassCard style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={option.icon} size={22} color={colors.brand} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{option.title}</Text>
                <Text style={styles.cardDescription}>{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Infiny Stream est un lecteur : il ne fournit aucune chaîne. Utilisez uniquement des sources auxquelles vous avez
        légalement accès.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  options: { gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  cardDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  disclaimer: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl },
});
