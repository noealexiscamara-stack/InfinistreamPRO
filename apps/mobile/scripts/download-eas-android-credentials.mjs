/**
 * Download EAS-managed Android keystore → credentials.json + credentials/release.keystore
 * for local Gradle signing (same cert as EAS cloud builds).
 *
 * Usage from apps/mobile:
 *   node scripts/download-eas-android-credentials.mjs
 *
 * Requires logged-in Expo session (~/.expo/state.json). Never commit the outputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP_ID = '697ff48d-ee5a-4de6-88ed-d49de57f6fcf';
const OUT_DIR = path.join(ROOT, 'credentials');
const KEYSTORE_PATH = path.join(OUT_DIR, 'release.keystore');
const CREDENTIALS_JSON = path.join(ROOT, 'credentials.json');

function readSessionSecret() {
  const statePath = path.join(os.homedir(), '.expo', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const secret = state?.auth?.sessionSecret ?? state?.sessionSecret;
  if (!secret) throw new Error(`No Expo session in ${statePath}. Run: npx eas-cli login`);
  return secret;
}

async function gql(sessionSecret, query, variables) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'expo-session': sessionSecret,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

async function main() {
  const sessionSecret = readSessionSecret();

  for (const typeName of [
    'AndroidAppBuildCredentials',
    'AndroidKeystore',
    'AndroidAppCredentials',
  ]) {
    const intro = await gql(sessionSecret, `{ __type(name: "${typeName}") { fields { name } } }`);
    console.log(
      `${typeName}:`,
      intro.__type?.fields?.map((f) => f.name).join(', ') ?? '(missing)'
    );
  }

  // Full material query (may be restricted)
  let data;
  try {
    data = await gql(
      sessionSecret,
      `query ($appId: String!) {
        app {
          byId(appId: $appId) {
            fullName
            androidAppCredentials(filter: { legacyOnly: false }) {
              id
              applicationIdentifier
              androidAppBuildCredentialsList {
                id
                name
                isDefault
                androidKeystore {
                  id
                  keyAlias
                  type
                  keystorePassword
                  keyPassword
                  keystore
                  sha1CertificateFingerprint
                  sha256CertificateFingerprint
                }
              }
            }
          }
        }
      }`,
      { appId: APP_ID }
    );
  } catch (err) {
    console.warn('Secret-bearing query failed:', err.message);
    data = await gql(
      sessionSecret,
      `query ($appId: String!) {
        app {
          byId(appId: $appId) {
            fullName
            androidAppCredentials(filter: { legacyOnly: false }) {
              id
              applicationIdentifier
              androidAppBuildCredentialsList {
                id
                name
                isDefault
                androidKeystore {
                  id
                  keyAlias
                  type
                  sha1CertificateFingerprint
                }
              }
            }
          }
        }
      }`,
      { appId: APP_ID }
    );
  }

  console.log('App:', data.app.byId.fullName);
  const appCreds = data.app.byId.androidAppCredentials ?? [];
  const buildCreds = appCreds.flatMap((c) => c.androidAppBuildCredentialsList ?? []);
  const preferred = buildCreds.find((c) => c.isDefault) ?? buildCreds[0];
  const ks = preferred?.androidKeystore;
  if (!ks) {
    console.error('No androidKeystore. Payload:', JSON.stringify(data, null, 2));
    process.exit(2);
  }

  console.log('Using build credentials:', preferred.name, 'alias=', ks.keyAlias, 'sha1=', ks.sha1CertificateFingerprint);

  if (!ks.keystore || !ks.keystorePassword) {
    console.error('API did not return private keystore blob.');
    console.error('Interactive fallback (real terminal required):');
    console.error('  cd apps/mobile && npx eas-cli credentials -p android');
    console.error('  → Credentials.json: Upload/Download … → Download credentials from EAS');
    process.exit(2);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(KEYSTORE_PATH, Buffer.from(ks.keystore, 'base64'));
  fs.writeFileSync(
    CREDENTIALS_JSON,
    JSON.stringify(
      {
        android: {
          keystore: {
            keystorePath: path.relative(ROOT, KEYSTORE_PATH).replace(/\\/g, '/'),
            keystorePassword: ks.keystorePassword,
            keyAlias: ks.keyAlias,
            keyPassword: ks.keyPassword ?? ks.keystorePassword,
          },
        },
      },
      null,
      2
    )
  );
  console.log('Wrote', CREDENTIALS_JSON);
  console.log('Wrote', KEYSTORE_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
