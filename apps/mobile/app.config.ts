import { execSync } from 'child_process';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.config runs in Node during prebuild / EAS — require keeps JSON loading simple.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appJson = require('./app.json') as { expo: ExpoConfig };

/** Full git SHA baked into the binary at config-eval time (EAS or local git). */
function resolveBuildGitSha(): string {
  const fromEas = process.env.EAS_BUILD_GIT_COMMIT_HASH?.trim();
  if (fromEas) return fromEas;

  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo as ExpoConfig;

  return {
    ...config,
    ...base,
    extra: {
      ...base.extra,
      buildGitSha: resolveBuildGitSha(),
    },
  };
};
