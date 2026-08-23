import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, elevation, radius, spacing, typography } from '@/theme/tokens';
import { GlassCard } from '@/components/ui/GlassCard';
import { pairingHintUrl } from '@/services/pairing/pairingApi';
import { usePairingSession } from '@/services/pairing/usePairingSession';

interface PhonePairingCardProps {
  scale?: number;
  dense?: boolean;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PhonePairingCard({ scale = 1, dense = false }: PhonePairingCardProps) {
  const { session, error, refreshing, refresh } = usePairingSession();
  const qrSize = Math.round((dense ? 88 : 120) * scale);

  return (
    <GlassCard style={[styles.card, elevation.cardSubtle, elevation.cardGlow('rgba(78,196,255,0.25)'), { flex: 1, padding: Math.round(spacing.md * scale) }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, dense && styles.headerIconDense]}>
          <Ionicons name="phone-portrait-outline" size={dense ? 16 : 20} color={colors.cyan} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, dense && { fontSize: 10 }]}>Configurer avec votre téléphone</Text>
          {!dense && (
            <Text style={styles.lede} numberOfLines={3}>
              Scannez le QR code pour ajouter votre IPTV, créer votre compte ou activer Premium.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.codeBlock}>
          <Text style={styles.orLabel}>Ou entrez ce code sur</Text>
          <View style={styles.urlBox}>
            <Text style={styles.urlText}>{pairingHintUrl()}</Text>
          </View>
          <Text style={[styles.code, { fontSize: Math.round(28 * scale) }]}>{session?.displayCode ?? '······'}</Text>
          {session ? (
            <View style={styles.expiryRow}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.textTertiary} />
              <Text style={styles.expiry}>
                Code temporaire · expire dans {formatCountdown(session.secondsRemaining)}
              </Text>
            </View>
          ) : (
            <Text style={styles.expiry}>{error ?? (refreshing ? 'Génération…' : 'En attente')}</Text>
          )}
          {error && (
            <Pressable onPress={refresh} style={styles.retry}>
              <Text style={styles.retryLabel}>Réessayer</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.qrWrap, { width: qrSize + 12, height: qrSize + 12 }]}>
          {session ? (
            <QRCode value={session.qrUrl} size={qrSize} backgroundColor="#FFFFFF" color="#070B16" />
          ) : (
            <ActivityIndicator color={colors.cyan} />
          )}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderColor: colors.borderStrong, flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconDense: { width: 28, height: 28 },
  headerCopy: { flex: 1, gap: 2 },
  kicker: { ...typography.label, color: colors.cyan },
  lede: { ...typography.caption, color: colors.textSecondary },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeBlock: { flex: 1, gap: spacing.xs },
  orLabel: { ...typography.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  urlBox: {
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  urlText: { ...typography.bodyStrong, color: colors.cyan, fontSize: 12 },
  code: {
    ...typography.display,
    color: colors.cyan,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expiry: { ...typography.caption, color: colors.textTertiary },
  retry: { alignSelf: 'flex-start', marginTop: spacing.xs },
  retryLabel: { ...typography.bodyStrong, color: colors.cyan },
  qrWrap: {
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    ...elevation.cardGlow('rgba(78,196,255,0.45)'),
  },
});
