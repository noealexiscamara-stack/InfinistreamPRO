# Build Android local — Infiny Stream

Procédure pour produire un APK **signé avec le même keystore qu'EAS**, installable
par-dessus les builds preview cloud **sans désinstaller** (base SQLite / migrations
conservées), et pour lancer un émulateur afin de reproduire import / lecture / UI
sans passer par l'utilisateur.

Machine de référence : Windows, JDK 17, Android SDK sous `%LOCALAPPDATA%\Android\Sdk`.

## Prérequis

Déjà présents sur la machine de dev (août 2026) :

| Composant | Emplacement typique |
|-----------|---------------------|
| JDK 17 | `JAVA_HOME=C:\Program Files\Microsoft\jdk-17.*` |
| Android SDK | `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk` |
| cmdline-tools | `%ANDROID_HOME%\cmdline-tools\latest\` |
| platform-tools / build-tools / emulator | sous `%ANDROID_HOME%` |
| Image système | `system-images;android-35;google_apis;x86_64` |
| AVD | `Infiny_API35` (Pixel 6, API 35) |

Vérifier :

```powershell
java -version
echo $env:ANDROID_HOME
adb version
& "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
```

Si le SDK manque (nouvelle machine) :

1. Installer [Android Studio](https://developer.android.com/studio) ou les
   command-line tools seuls.
2. Accepter les licences : `sdkmanager --licenses`
3. Installer au minimum :
   `platforms;android-35`, `build-tools;35.0.0`, `platform-tools`, `emulator`,
   `system-images;android-35;google_apis;x86_64`
4. Créer l'AVD :
   `avdmanager create avd -n Infiny_API35 -k "system-images;android-35;google_apis;x86_64" -d pixel_6`

## Signature — ne jamais improvisers

Un APK signé avec une autre clé **ne s'installe pas** par-dessus l'app EAS
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). L'utilisateur devrait désinstaller et
perdrait sa base locale.

### Récupérer le keystore EAS (une fois par machine)

Depuis `apps/mobile`, connecté (`eas whoami`) :

```powershell
npx eas-cli credentials -p android
```

Choisir le profil **preview** (ou production si c'est la même clé upload), puis :

1. `credentials.json: Upload/Download credentials between EAS servers and your local json`
2. `Download credentials from EAS to credentials.json`

Cela crée (tous **gitignored**) :

- `apps/mobile/credentials.json`
- `apps/mobile/credentials/*.jks` ou `release.keystore` (chemin indiqué dans le JSON)

Puis générer `android/keystore.properties` (aussi gitignored) :

```powershell
# Après un prebuild qui a créé android/
$j = Get-Content .\credentials.json -Raw | ConvertFrom-Json
$ks = $j.android.keystore
$root = (Resolve-Path .).Path -replace '\\','/'
@"
storePassword=$($ks.keystorePassword)
keyPassword=$($ks.keyPassword)
keyAlias=$($ks.keyAlias)
storeFile=$root/credentials/release.keystore
"@ | Set-Content .\android\keystore.properties -Encoding ASCII
```

Adapte `storeFile` au chemin réel du fichier téléchargé (`keystorePath` dans
`credentials.json`).

### Vérifier que c'est la même clé qu'EAS

Comparer l'empreinte SHA-256 du certificat keystore avec celle d'un APK EAS
(ex. build `bc29df5`) via `apksigner verify --print-certs` et
`keytool -exportcert` + hash. Elles doivent être **identiques**.

Le plugin Expo `./plugins/withLocalReleaseSigning` réinjecte le bloc Gradle
`signingConfigs.release` à chaque `expo prebuild` pour lire
`android/keystore.properties`.

## Produire l'APK (release)

Depuis la racine du monorepo, sur le commit voulu (ex. `dee2cb1`) :

```powershell
cd apps/mobile
$env:EXPO_PUBLIC_API_URL = "https://api.infinistream.pro"

# Régénère android/ (écrase le dossier). Puis restaurer keystore.properties (ci-dessus).
npx expo prebuild --platform android --no-install

# versionCode doit être > celui de l'APK installé (bc29df5 = 5).
# Défini dans app.json → expo.android.versionCode

cd android
.\gradlew.bat assembleRelease --no-daemon
```

APK produit :

```
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Copie utile :

```powershell
Copy-Item .\app\build\outputs\apk\release\app-release.apk `
  ..\..\..\dist\infiny-dee2cb1-local.apk -Force
```

### Installer par-dessus sans désinstaller

Téléphone USB (débogage) ou émulateur :

```powershell
adb install -r path\to\app-release.apk
```

`-r` = replace / upgrade. Si tu vois `INSTALL_FAILED_UPDATE_INCOMPATIBLE`,
la signature n'est **pas** celle d'EAS — ne force **pas** une désinstallation
sur le téléphone de prod utilisateur.

## Émulateur

```powershell
# Lancer
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd Infiny_API35 -netdelay none -netspeed full

# Dans un autre terminal
adb wait-for-device
adb install -r apps\mobile\android\app\build\outputs\apk\release\app-release.apk
adb shell am start -n com.infinystream.app/.MainActivity
```

Cas à reproduire localement avant de demander un test utilisateur :

1. Import M3U (`playlist_finale.m3u`) → Films = 0, Séries = 0
2. Lecture d'une chaîne + échec volontaire (URL morte) → écran Diagnostic
3. Cadrage (Ajusté → Rempli → …) et contrôles hors encoche / barre système
4. Migration v3 sans réimport (installer par-dessus une base v2)

## Alternative : `eas build --local`

```powershell
cd apps/mobile
npx eas-cli build -p android -e preview --local --non-interactive --output ..\..\dist\preview-local.apk
```

Utilise les credentials EAS distants pour signer, sans consommer le quota cloud
*de compilation* (selon le plan). Moins pratique pour itérer que Gradle une fois
`android/` en place.

## AAB production + piste de test interne Play

Le profil EAS `production` produit un **Android App Bundle** (`buildType: app-bundle`),
pas un APK universel. Play découpe le téléchargement par ABI.

**Ne pas déclarer l'AAB validé tant qu'il n'a pas été installé via la piste
interne** — un AAB qui compile n'est pas un AAB qui s'installe.

Procédure :

1. Build AAB local (même keystore EAS) :
   ```powershell
   cd apps/mobile/android
   .\gradlew.bat bundleRelease --no-daemon
   # → app/build/outputs/bundle/release/app-release.aab
   ```
   ou `eas build -p android -e production` (cloud).

2. Play Console → application → **Tests** → **Tests internes** → créer une
   release, uploader l'AAB, ajouter le compte Google de la tablette comme
   testeur, accepter le lien d'invitation sur l'appareil.

3. Installer depuis Play (pas sideload). Noter :
   - taille de **téléchargement** affichée par Play (ABI seul, typ. arm64) ;
   - taille **installée** (`adb shell pm path` / paramètres Android) ;
   - que l'upgrade se fait **par-dessus** l'APK sideload signé EAS (même clé).

4. Coller les deux tailles dans le rapport de build. Sans ça, on reste sur
   l'estimation « ¼–½ de l'APK universel ».

Le sideload de validation UI reste l'**APK** universel (`assembleRelease` /
`infiny-<sha>-local.apk`).

## Fichiers secrets — ne jamais committer

Déjà dans `apps/mobile/.gitignore` :

- `credentials.json`
- `credentials/`
- `*.jks` / `*.keystore`
- `/android` (dossier généré, y compris `keystore.properties`)

Le plugin `withLocalReleaseSigning.js` et cette doc, oui. Les mots de passe, non.

## Quota EAS cloud

Quand le plan Free Android est épuisé, **cette procédure locale** est le chemin
par défaut. Ne pas attendre le reset mensuel pour un correctif lecteur.
