import Constants from 'expo-constants';

/** Full commit SHA injected via app.config.ts (EAS_BUILD_GIT_COMMIT_HASH or local git). */
export function getBuildGitSha(): string {
  const sha = Constants.expoConfig?.extra?.buildGitSha;
  return typeof sha === 'string' && sha.length > 0 ? sha : 'unknown';
}

/** Short SHA for compact UI (first 7 hex chars). */
export function getBuildGitShaShort(): string {
  const sha = getBuildGitSha();
  return sha === 'unknown' ? sha : sha.slice(0, 7);
}
