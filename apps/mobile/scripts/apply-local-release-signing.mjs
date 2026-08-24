/**
 * After `npx expo prebuild`, write android/keystore.properties and force the
 * release buildType to sign with the EAS production keystore (credentials.json).
 *
 * Usage from apps/mobile:
 *   node scripts/apply-local-release-signing.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CREDENTIALS_JSON = path.join(ROOT, 'credentials.json');
const ANDROID_DIR = path.join(ROOT, 'android');
const APP_GRADLE = path.join(ANDROID_DIR, 'app', 'build.gradle');
const KEYSTORE_PROPS = path.join(ANDROID_DIR, 'keystore.properties');

const MARKER_START = '// INFINIT_LOCAL_SIGNING_START';
const MARKER_END = '// INFINIT_LOCAL_SIGNING_END';

function main() {
  if (!fs.existsSync(CREDENTIALS_JSON)) {
    throw new Error('Missing credentials.json — run: node scripts/download-eas-android-credentials.mjs');
  }
  if (!fs.existsSync(APP_GRADLE)) {
    throw new Error('Missing android/app/build.gradle — run: npx expo prebuild --platform android');
  }

  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_JSON, 'utf8'));
  const ks = creds?.android?.keystore;
  if (!ks?.keystorePath || !ks.keystorePassword || !ks.keyAlias) {
    throw new Error('credentials.json missing android.keystore fields');
  }

  const storeFileAbs = path.resolve(ROOT, ks.keystorePath);
  if (!fs.existsSync(storeFileAbs)) {
    throw new Error(`Keystore file not found: ${storeFileAbs}`);
  }

  const props = [
    `storePassword=${ks.keystorePassword}`,
    `keyPassword=${ks.keyPassword ?? ks.keystorePassword}`,
    `keyAlias=${ks.keyAlias}`,
    `storeFile=${storeFileAbs.replace(/\\/g, '/')}`,
    '',
  ].join('\n');
  fs.writeFileSync(KEYSTORE_PROPS, props);
  console.log('Wrote', KEYSTORE_PROPS);

  let gradle = fs.readFileSync(APP_GRADLE, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 6');

  if (gradle.includes(MARKER_START)) {
    gradle = gradle.replace(new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'g'), '');
  }

  const snippet = `
${MARKER_START}
def infinitKeystorePropertiesFile = rootProject.file("keystore.properties")
def infinitKeystoreProperties = new Properties()
if (infinitKeystorePropertiesFile.exists()) {
    infinitKeystoreProperties.load(new FileInputStream(infinitKeystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (infinitKeystorePropertiesFile.exists()) {
                keyAlias infinitKeystoreProperties['keyAlias']
                keyPassword infinitKeystoreProperties['keyPassword']
                storeFile file(infinitKeystoreProperties['storeFile'])
                storePassword infinitKeystoreProperties['storePassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
${MARKER_END}
`;

  gradle = `${gradle.trimEnd()}\n${snippet}\n`;
  fs.writeFileSync(APP_GRADLE, gradle);
  console.log('Patched', APP_GRADLE, '(versionCode 6 + release signing)');
}

main();
