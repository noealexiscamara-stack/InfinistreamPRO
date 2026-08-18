import { M3uImportError } from '@/services/m3u/importM3u';
import { XtreamConnectionError } from '@/services/xtream/importXtream';

export interface FriendlyImportErrorInfo {
  title: string;
  cause: string;
}

function fallbackDownloadCause(err: unknown, url?: string): string {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  const isHttp = (url ?? '').toLowerCase().startsWith('http://');
  if (/timeout|timed out|aborted/.test(message)) return 'Délai dépassé';
  if (isHttp && /network request failed|failed to fetch|cleartext/.test(message)) {
    return 'HTTP en clair bloqué';
  }
  if (/network request failed|failed to fetch|network error/.test(message)) {
    return 'Connexion impossible';
  }
  return 'Le serveur n’a pas répondu';
}

function xtreamCause(err: XtreamConnectionError, url?: string): string {
  if (err.kind === 'network' && (url ?? '').toLowerCase().startsWith('http://')) {
    return 'HTTP en clair bloqué';
  }
  return err.causeLabel;
}

/**
 * Maps internal/technical errors to a short, non-technical title + cause.
 * Never returns a raw exception string (product rule #30).
 */
export function describeImportError(err: unknown, context?: { url?: string }): FriendlyImportErrorInfo {
  if (err instanceof M3uImportError) {
    return { title: err.title, cause: err.causeLabel };
  }

  if (err instanceof XtreamConnectionError) {
    return { title: err.title, cause: xtreamCause(err, context?.url) };
  }

  if (err instanceof TypeError && /network|fetch/i.test(err.message)) {
    return {
      title: 'Impossible de télécharger la playlist',
      cause: fallbackDownloadCause(err, context?.url),
    };
  }

  return {
    title: 'Impossible d’ajouter cette source',
    cause: 'Vérifiez les informations saisies',
  };
}
