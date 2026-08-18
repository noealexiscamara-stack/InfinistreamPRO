import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { colors, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

export default function AccountScreen() {
  const email = useAuthStore((s) => s.email);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const subscriptionStatus = useSubscriptionStore((s) => s.status);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Mon compte</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {isAuthenticated ? (
          <GlassCard style={styles.accountCard}>
            <Ionicons name="person-circle" size={48} color={colors.brand} />
            {!!user?.name && <Text style={styles.name}>{user.name}</Text>}
            <Text style={styles.email}>{user?.email ?? email}</Text>
            {subscriptionStatus && (
              <Text style={styles.meta}>
                {subscriptionStatus.isPremium
                  ? 'Abonnement Premium actif'
                  : subscriptionStatus.isTrial
                    ? `Essai gratuit — ${subscriptionStatus.daysRemaining} jours restants`
                    : 'Essai terminé — renouvelez Premium'}
              </Text>
            )}
            <Button label="Se déconnecter" variant="secondary" onPress={handleLogout} />
          </GlassCard>
        ) : (
          <GlassCard style={styles.emptyAccount}>
            <Ionicons name="person-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Aucun compte connecté</Text>
            <Text style={styles.emptyMeta}>
              Un compte est nécessaire pour activer Premium, synchroniser vos favoris et gérer vos appareils.
            </Text>
            <Button label="Se connecter" onPress={() => router.push('/login')} />
            <Button label="Créer un compte" variant="ghost" onPress={() => router.push('/register')} />
          </GlassCard>
        )}

        <GlassCard>
          <Text style={styles.sectionTitle}>Cet appareil</Text>
          <View style={styles.deviceRow}>
            <Ionicons
              name={Device.deviceType === Device.DeviceType.TV ? 'tv-outline' : 'phone-portrait-outline'}
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.deviceLabel}>{Device.modelName ?? 'Appareil'}</Text>
          </View>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { ...typography.headline, color: colors.textPrimary },
  content: { padding: spacing.xl, gap: spacing.lg },
  accountCard: { alignItems: 'center', gap: spacing.sm },
  name: { ...typography.title, color: colors.textPrimary },
  email: { ...typography.bodyStrong, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  emptyAccount: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { ...typography.headline, color: colors.textPrimary },
  emptyMeta: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deviceLabel: { ...typography.body, color: colors.textPrimary },
});
