import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FALLBACK_PRICING_CONFIG } from '@infiny-stream/config';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { getTrialStatus } from '@/services/subscription/localTrial';

const PREMIUM_FEATURES = [
  'Multi-playlists',
  'Guide des programmes (EPG)',
  'Android TV',
  'Synchronisation favoris et historique',
  'Plusieurs appareils',
  'Aucune publicité',
];

export default function SubscriptionScreen() {
  const [trial, setTrial] = useState<{ daysRemaining: number; expired: boolean } | null>(null);

  useEffect(() => {
    setTrial(getTrialStatus());
  }, []);

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
          <Ionicons name="star" size={28} color={colors.brand} />
          <Text style={styles.statusTitle}>
            {trial?.expired ? "Votre essai gratuit est terminé" : `Essai gratuit — ${trial?.daysRemaining ?? '—'} jours restants`}
          </Text>
          <Text style={styles.statusMeta}>
            Pendant l'essai, profitez de l'expérience Premium complète, sans engagement.
          </Text>
        </GlassCard>

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
            {FALLBACK_PRICING_CONFIG.basePrice} {FALLBACK_PRICING_CONFIG.baseCurrency}
          </Text>
          <Text style={styles.priceMeta}>par an, après l'essai gratuit</Text>
        </View>

        <Button
          label={trial?.expired ? 'Renouveler Premium' : "Passer à Premium maintenant"}
          onPress={() => {
            // Paiement (Orange Money / MTN Mobile Money / HoloPay) et
            // activation côté serveur — voir apps/backend PaymentService.
            // Non branché dans cette passe : le paiement doit toujours
            // être vérifié par le backend (règle produit #41), jamais
            // uniquement côté client.
          }}
        />
        <Text style={styles.disclaimer}>
          Le prix affiché peut varier selon votre pays et vos promotions en cours. Le paiement est vérifié par nos
          serveurs avant toute activation.
        </Text>
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
