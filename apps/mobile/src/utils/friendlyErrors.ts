import { XtreamConnectionError } from '@/services/xtream/importXtream';

/**
 * Maps internal/technical errors to the short, non-technical messages the
 * product spec requires (rule #30: never show a raw exception). Kept in
 * one place so every screen that imports/connects a source says the same
 * thing for the same failure.
 */
export function friendlyImportError(err: unknown): string {
  if (err instanceof XtreamConnectionError) {
    switch (err.kind) {
      case 'invalid_credentials':
        return err.message || 'Identifiants incorrects. Vérifiez le serveur, le nom d’utilisateur et le mot de passe.';
      case 'network':
        return 'Impossible de contacter ce serveur. Vérifiez votre connexion.';
      case 'server_error':
        return 'Le serveur a rencontré un problème. Réessayez plus tard.';
      case 'malformed_response':
        return "Réponse du serveur inattendue. Vérifiez l'adresse du serveur.";
    }
  }

  if (err instanceof TypeError && /network/i.test(err.message)) {
    return 'Impossible de télécharger cette playlist. Vérifiez votre connexion et le lien.';
  }

  return "Impossible d'ajouter cette source pour le moment. Vérifiez les informations saisies et réessayez.";
}
