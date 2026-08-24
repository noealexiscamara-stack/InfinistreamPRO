import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@/components/ui/ScreenSafeArea';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { APP_NAME } from '@infiny-stream/config';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/useAuthStore';
import { friendlyAuthError } from '@/utils/authErrors';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError('Veuillez saisir votre email.');
      return;
    }
    if (!password) {
      setError('Veuillez saisir votre mot de passe.');
      return;
    }

    try {
      await login(email, password);
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>

            <View style={styles.brand}>
              <Text style={styles.appName}>{APP_NAME}</Text>
              <Text style={styles.subtitle}>Connectez-vous pour synchroniser vos favoris et gérer Premium.</Text>
            </View>

            <GlassCard style={styles.form}>
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
                autoComplete="password"
                textContentType="password"
                placeholder="••••••••"
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button label="Se connecter" onPress={handleSubmit} loading={isLoading} />
            </GlassCard>

            <Pressable onPress={() => router.push('/register')} style={styles.linkRow}>
              <Text style={styles.linkText}>
                Pas encore de compte ? <Text style={styles.linkBold}>Créer un compte</Text>
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
