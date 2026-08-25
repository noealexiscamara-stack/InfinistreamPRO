import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { UniverseHeader } from '@/components/universe/UniverseHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import {
  countAdultCategories,
  listManagedCategories,
  setCategoryAdultFlag,
  type ManagedCategoryRow,
} from '@/services/channelsRepository';
import { isValidPinFormat } from '@/services/parental/parentalPin';
import { parentalLockoutLabel, useParentalStore } from '@/store/useParentalStore';

type Mode = 'hub' | 'create' | 'unlock' | 'manage';

export default function ParentalControlScreen() {
  const pinConfigured = useParentalStore((s) => s.pinConfigured);
  const unlocked = useParentalStore((s) => s.unlocked);
  const lockoutUntil = useParentalStore((s) => s.lockoutUntil);
  const hydrate = useParentalStore((s) => s.hydrate);
  const createPin = useParentalStore((s) => s.createPin);
  const unlock = useParentalStore((s) => s.unlock);
  const lock = useParentalStore((s) => s.lock);

  const [mode, setMode] = useState<Mode>('hub');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adultCount, setAdultCount] = useState(0);
  const [categories, setCategories] = useState<ManagedCategoryRow[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    countAdultCategories().then(setAdultCount).catch(() => setAdultCount(0));
  }, [unlocked, mode]);

  useEffect(() => {
    if (lockoutUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockoutUntil]);

  const lockoutLabel = parentalLockoutLabel(lockoutUntil, now);

  const loadManageList = useCallback(async () => {
    setLoadingCats(true);
    try {
      const rows = await listManagedCategories();
      setCategories(rows);
      setAdultCount(rows.filter((r) => r.isAdult).length);
    } finally {
      setLoadingCats(false);
    }
  }, []);

  const openManage = useCallback(async () => {
    if (!unlocked) {
      setMode('unlock');
      setError(null);
      setPin('');
      return;
    }
    setMode('manage');
    await loadManageList();
  }, [unlocked, loadManageList]);

  const submitCreate = async () => {
    setError(null);
    if (!isValidPinFormat(pin)) {
      setError('Le code doit contenir 4 chiffres.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('Les deux codes ne correspondent pas.');
      return;
    }
    await createPin(pin);
    setPin('');
    setPinConfirm('');
    setMode('hub');
  };

  const submitUnlock = async () => {
    setError(null);
    const result = await unlock(pin);
    setPin('');
    if (result.ok) {
      setMode('manage');
      await loadManageList();
      return;
    }
    if (result.reason === 'locked') {
      setError(`Trop d'essais. ${parentalLockoutLabel(Date.now() + (result.lockedMs ?? 0)) ?? ''}`);
    } else if (result.reason === 'wrong') {
      setError(`Code incorrect. ${result.attemptsLeft ?? 0} essai(s) restant(s).`);
    } else if (result.reason === 'no_pin') {
      setError('Aucun code défini.');
    } else {
      setError('Code invalide.');
    }
  };

  const toggleAdult = async (row: ManagedCategoryRow, next: boolean) => {
    await setCategoryAdultFlag(row.id, next);
    setCategories((prev) => prev.map((c) => (c.id === row.id ? { ...c, isAdult: next } : c)));
    setAdultCount((n) => n + (next ? 1 : -1));
  };

  const adultOnly = useMemo(() => categories.filter((c) => c.isAdult), [categories]);
  const others = useMemo(() => categories.filter((c) => !c.isAdult), [categories]);

  return (
    <ScreenSafeArea style={styles.safeArea}>
      <UniverseHeader
        title="Contrôle parental"
        onBack={
          mode === 'hub'
            ? undefined
            : () => {
                setMode('hub');
                setError(null);
                setPin('');
                setPinConfirm('');
              }
        }
      />

      {mode === 'hub' ? (
        <View style={styles.body}>
          <GlassCard>
            <Text style={styles.lead}>
              Les catégories adultes (XXX, Adult, Porn…) sont masquées par défaut partout dans
              l'application.
            </Text>
            <Text style={styles.meta}>
              Catégories marquées adultes : {adultCount.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.meta}>
              Contenu adulte : {unlocked ? 'visible (session)' : 'masqué'}
            </Text>
          </GlassCard>

          {!pinConfigured ? (
            <Button label="Créer un code PIN" onPress={() => setMode('create')} />
          ) : (
            <>
              {!unlocked ? (
                <Button label="Déverrouiller avec le PIN" onPress={() => setMode('unlock')} />
              ) : (
                <Button
                  label="Verrouiller à nouveau"
                  onPress={() => {
                    lock();
                    setMode('hub');
                  }}
                />
              )}
              <Button label="Gérer les catégories adultes" onPress={() => void openManage()} />
            </>
          )}

          {!pinConfigured ? (
            <Text style={styles.hint}>
              Sans code PIN, les catégories adultes restent masquées — aucun contournement.
            </Text>
          ) : null}
        </View>
      ) : null}

      {mode === 'create' ? (
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Créer un code à 4 chiffres</Text>
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="••••"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.pinInput}
            value={pinConfirm}
            onChangeText={(t) => setPinConfirm(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="Confirmer"
            placeholderTextColor={colors.textTertiary}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Enregistrer le PIN" onPress={() => void submitCreate()} />
          <Text style={styles.hint}>
            Le code est stocké haché (SHA-256 + sel) dans le stockage sécurisé de l'appareil — jamais
            en clair.
          </Text>
        </View>
      ) : null}

      {mode === 'unlock' ? (
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Entrer le code PIN</Text>
          {lockoutLabel ? <Text style={styles.error}>{lockoutLabel}</Text> : null}
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            editable={!lockoutLabel}
            placeholder="••••"
            placeholderTextColor={colors.textTertiary}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="Déverrouiller"
            onPress={() => void submitUnlock()}
            disabled={Boolean(lockoutLabel)}
          />
        </View>
      ) : null}

      {mode === 'manage' ? (
        loadingCats ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={[...adultOnly, ...others]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.manageHint}>
                Marquez ou démarquez une catégorie. Les mots-clés automatiques ne sont jamais
                complets.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.catRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.catMeta}>
                    {item.kind} · {item.channelCount} titres
                  </Text>
                </View>
                <Switch
                  value={item.isAdult}
                  onValueChange={(v) => void toggleAdult(item, v)}
                  trackColor={{ true: colors.brand, false: colors.border }}
                />
              </View>
            )}
          />
        )
      ) : null}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.md },
  lead: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.sm },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: { ...typography.headline, color: colors.textPrimary },
  pinInput: {
    ...typography.title,
    color: colors.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textTertiary },
  list: { padding: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.xs },
  manageHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  catName: { ...typography.bodyStrong, color: colors.textPrimary },
  catMeta: { ...typography.caption, color: colors.textSecondary },
});
