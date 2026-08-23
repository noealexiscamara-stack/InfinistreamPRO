/** Pure helpers for playback failure diagnostics — no native deps. */

export function formatTimeToFailure(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Extracts code + message from expo-video / ExoPlayer error payloads. */
export function extractPlayerError(error: unknown): { code: string | null; message: string; raw: string } {
  let raw = '';
  try {
    raw = JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2);
  } catch {
    raw = String(error);
  }

  if (error == null) {
    return { code: null, message: 'Erreur inconnue (pas de détail exposé)', raw };
  }

  if (typeof error === 'string') {
    return { code: null, message: error, raw };
  }

  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const message =
      (typeof obj.message === 'string' && obj.message) ||
      (typeof obj.errorMessage === 'string' && obj.errorMessage) ||
      (typeof obj.localizedDescription === 'string' && obj.localizedDescription) ||
      raw;
    const codeCandidate =
      obj.code ?? obj.errorCode ?? obj.error_code ?? obj.type ?? obj.name ?? null;
    const code = codeCandidate == null ? null : String(codeCandidate);
    return { code, message: String(message), raw };
  }

  return { code: null, message: String(error), raw };
}
