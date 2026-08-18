/**
 * Config plugin: enables a proper Android TV / Fire TV experience.
 *
 * Expo's managed `android` config block does not expose the leanback
 * launcher category or the `android:banner` attribute that TV launchers
 * require to show Infiny Stream as a TV app (with focus-friendly banner
 * artwork instead of a phone icon). This plugin patches the generated
 * AndroidManifest.xml during `expo prebuild` / EAS Build:
 *
 *  - <uses-feature android.software.leanback required="false" />
 *    (false = app also installs on regular phones/tablets)
 *  - <uses-feature android.hardware.touchscreen required="false" />
 *  - adds android:banner + LEANBACK_LAUNCHER category on the main activity
 *  - copies assets/images/tv_banner.png -> res/drawable/tv_banner.png
 *
 * This only takes effect on a native build (EAS Build or local
 * `expo prebuild` + Gradle/Android SDK) — it cannot be verified inside a
 * plain JS/Metro sandbox with no Android SDK.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const BANNER_DRAWABLE = '@drawable/tv_banner';
const BANNER_SOURCE = path.join('assets', 'images', 'tv_banner.png');

function ensureUsesFeature(manifest, name, required) {
  manifest.manifest['uses-feature'] = manifest.manifest['uses-feature'] || [];
  const list = manifest.manifest['uses-feature'];
  const exists = list.find((f) => f.$['android:name'] === name);
  if (exists) {
    exists.$['android:required'] = String(required);
    return;
  }
  list.push({ $: { 'android:name': name, 'android:required': String(required) } });
}

function withAndroidTvManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    ensureUsesFeature(manifest, 'android.software.leanback', false);
    ensureUsesFeature(manifest, 'android.hardware.touchscreen', false);

    const application = manifest.manifest.application?.[0];
    if (application) {
      application.$['android:banner'] = BANNER_DRAWABLE;

      const mainActivity = application.activity?.find((activity) =>
        activity['intent-filter']?.some((filter) =>
          filter.action?.some((a) => a.$['android:name'] === 'android.intent.action.MAIN')
        )
      );

      if (mainActivity) {
        const mainFilter = mainActivity['intent-filter'].find((filter) =>
          filter.action?.some((a) => a.$['android:name'] === 'android.intent.action.MAIN')
        );
        mainFilter.category = mainFilter.category || [];
        const hasLeanback = mainFilter.category.some(
          (c) => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
        );
        if (!hasLeanback) {
          mainFilter.category.push({
            $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' },
          });
        }
      }
    }

    return config;
  });
}

function withAndroidTvBannerAsset(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const source = path.join(projectRoot, BANNER_SOURCE);
      if (!fs.existsSync(source)) {
        throw new Error(
          `Missing Android TV banner asset at ${BANNER_SOURCE}. Add a 320x180 PNG before building.`
        );
      }

      const destDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(source, path.join(destDir, 'tv_banner.png'));
      return config;
    },
  ]);
}

function withAndroidTv(config) {
  config = withAndroidTvBannerAsset(config);
  config = withAndroidTvManifest(config);
  return config;
}

module.exports = withAndroidTv;
