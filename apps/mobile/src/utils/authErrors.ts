import { ApiError } from '@/services/api/client';

export function friendlyAuthError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Email ou mot de passe incorrect.';
    if (err.status === 409) return 'Un compte existe déjà avec cet email.';
    if (err.status >= 500) return 'Le serveur est indisponible. Réessayez plus tard.';
    return err.message;
  }

  if (err instanceof TypeError && /network|fetch/i.test(err.message)) {
    return 'Impossible de contacter le serveur. Vérifiez votre connexion.';
  }

  return 'Une erreur est survenue. Réessayez.';
}
