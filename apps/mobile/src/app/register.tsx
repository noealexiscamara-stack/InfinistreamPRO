import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { APP_NAME } from '@infiny-stream/config';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/useAuthStore';
import { friendlyAuthError } from '@/utils/authErrors';

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError('Veuillez saisir votre email.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    try {
      await register({
        email,
        password,
        name: name.trim() || undefined,
      });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  }

  return (
    <LinearGradient colors={[colors.background, '#131726']} style={styles.container}>
      <ScreenSafeArea style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>

            <View style={styles.brand}>
              <Text style={styles.appName}>{APP_NAME}</Text>
              <Text style={styles.subtitle}>Créez votre compte — l'essai Premium démarre immédiatement.</Text>
            </View>

            <GlassCard style={styles.form}>
              <TextField
                label="Nom (optionnel)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholder="Votre prénom"
              />
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="vous@exemple.com"
              />
              <TextField
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="8 caractères minimum"
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button label="Créer mon compte" onPress={handleSubmit} loading={isLoading} />
            </GlassCard>

            <Pressable onPress={() => router.push('/login')} style={styles.linkRow}>
              <Text style={styles.linkText}>
                Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  back: { alignSelf: 'flex-start' },
  brand: { gap: spacing.sm, marginTop: spacing.md },
  appName: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  error: { ...typography.caption, color: colors.danger },
  linkRow: { alignItems: 'center', marginTop: spacing.sm },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { color: colors.brand, fontWeight: '700' },
});
