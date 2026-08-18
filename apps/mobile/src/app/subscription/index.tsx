import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { selectDisplayPrice, useConfigStore } from '@/store/useConfigStore';

const PREMIUM_FEATURES = [
  'Multi-playlists',
  'Guide des programmes (EPG)',
  'Android TV',
  'Synchronisation favoris et historique',
  'Plusieurs appareils',
  'Aucune publicité',
];

export default function SubscriptionScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const status = useSubscriptionStore((s) => s.status);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const error = useSubscriptionStore((s) => s.error);
  const refresh = useSubscriptionStore((s) => s.refresh);
  const pricing = useConfigStore((s) => s.pricing);
  const refreshConfig = useConfigStore((s) => s.refresh);
  const displayPrice = selectDisplayPrice(pricing);
  const [needsLogin, setNeedsLogin] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setNeedsLogin(true);
      return;
    }
    setNeedsLogin(false);
    try {
      await Promise.all([refreshConfig(), refresh()]);
    } catch {
      /* error surfaced via store */
    }
  }, [isAuthenticated, refresh, refreshConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusTitle = (() => {
    if (needsLogin) return 'Connectez-vous pour voir votre abonnement';
    if (isLoading && !status) return 'Chargement de votre abonnement…';
    if (error && !status) return error;
    if (!status) return 'Aucun abonnement trouvé pour ce compte';
    if (status.isPremium) return 'Abonnement Premium actif';
    if (status.expired) return "Votre essai gratuit est terminé";
    return `Essai gratuit — ${status.daysRemaining} jours restants`;
  })();

  const statusMeta = needsLogin
    ? 'Créez un compte ou connectez-vous — l’essai Premium démarre immédiatement côté serveur.'
    : "Statut vérifié par nos serveurs à chaque ouverture de cet écran (règle produit #41).";

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Abonnement</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <GlassCard style={styles.statusCard}>
          {isLoading && !status ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Ionicons name="star" size={28} color={colors.brand} />
          )}
          <Text style={styles.statusTitle}>{statusTitle}</Text>
          <Text style={styles.statusMeta}>{statusMeta}</Text>
        </GlassCard>

        {needsLogin ? (
          <>
            <Button label="Se connecter" onPress={() => router.push('/login')} />
            <Button label="Créer un compte" variant="ghost" onPress={() => router.push('/register')} />
          </>
        ) : (
          <>
            <GlassCard>
              <Text style={styles.sectionTitle}>Inclus avec Premium</Text>
              {PREMIUM_FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.featureLabel}>{feature}</Text>
                </View>
              ))}
            </GlassCard>

            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {displayPrice.amount} {displayPrice.currency}
              </Text>
              <Text style={styles.priceMeta}>par an, après l'essai gratuit</Text>
            </View>

            <Button
              label={status?.expired ? 'Renouveler Premium' : 'Passer à Premium maintenant'}
              onPress={() => {
                // Paiement (Orange Money / MTN / HoloPay) — voir apps/backend.
              }}
            />
            <Text style={styles.disclaimer}>
              Le prix affiché peut varier selon votre pays. Le paiement est vérifié par nos serveurs avant toute
              activation.
            </Text>
          </>
        )}
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
  statusCard: { alignItems: 'center', gap: spacing.sm },
  statusTitle: { ...typography.headline, color: colors.textPrimary, textAlign: 'center' },
  statusMeta: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  featureLabel: { ...typography.body, color: colors.textPrimary },
  priceRow: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  price: { ...typography.display, color: colors.textPrimary },
  priceMeta: { ...typography.caption, color: colors.textSecondary },
  disclaimer: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
});
