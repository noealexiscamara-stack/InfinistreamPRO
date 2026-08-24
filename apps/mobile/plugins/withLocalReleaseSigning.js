const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_MARKER = 'INFINIT_LOCAL_SIGNING_START';

const SIGNING_BLOCK = `
// INFINIT_LOCAL_SIGNING_START
// Reads android/keystore.properties (gitignored) pointing at the EAS upload keystore.
// Required so local release APKs install over EAS preview builds without uninstall.
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
// INFINIT_LOCAL_SIGNING_END
`;

/**
 * Injects release signing from android/keystore.properties after every prebuild.
 */
function withLocalReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(SIGNING_MARKER)) {
      return cfg;
    }
    cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${SIGNING_BLOCK}\n`;
    return cfg;
  });
}

module.exports = withLocalReleaseSigning;
