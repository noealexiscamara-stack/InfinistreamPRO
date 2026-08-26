# Guide de build

## Prérequis

- Node.js ≥ 20, npm ≥ 10.
- Pour un build natif Android : Android Studio + SDK (API 34+), ou un compte [Expo/EAS](https://expo.dev) pour
  déléguer le build au cloud (recommandé — c'est l'approche utilisée par la plupart des équipes Expo, et elle évite
  d'installer/maintenir le SDK Android en local).
- PostgreSQL ≥ 14 pour le backend.

## Installation

```bash
git clone <votre-repo>
cd infiny-stream
npm install   # installe tout le monorepo (workspaces npm : apps/* + packages/*)
```

## Packages partagés (`packages/types`, `packages/shared`, `packages/config`)

Pas de build séparé nécessaire pour le développement (les apps les consomment directement via TypeScript/Metro/
ts-node). Pour vérifier :

```bash
cd packages/shared && npx tsc --noEmit && npx jest
cd ../types && npx tsc --noEmit
cd ../config && npx tsc --noEmit
```

## Application mobile (`apps/mobile`)

### Développement (Expo Go / build de développement)

```bash
cd apps/mobile
npm run start          # ouvre Metro — scannez le QR code avec Expo Go, ou 'a' pour Android
```

`expo-sqlite`, `expo-video`, `react-native-mmkv` et les autres modules natifs utilisés ici **ne fonctionnent pas**
dans l'app "Expo Go" du store pour les versions récentes de certains modules — si Expo Go affiche une erreur de
module manquant, générez un **build de développement** :

```bash
npx expo install expo-dev-client
eas build --profile development --platform android   # nécessite un compte EAS (gratuit pour démarrer)
```

### Build Android — APK Debug

```bash
cd apps/mobile
eas build --profile preview --platform android --local   # --local nécessite le SDK Android en local
# ou, sans SDK local :
eas build --profile preview --platform android           # build dans le cloud EAS, télécharge l'APK à la fin
```

Si vous préférez un build 100% local sans EAS :

```bash
npx expo prebuild --platform android   # génère le dossier android/ natif
cd android && ./gradlew assembleDebug
# APK généré dans android/app/build/outputs/apk/debug/
```

### Build Android — APK/AAB Release

```bash
eas build --profile production --platform android
# ou en local, après prebuild :
cd android && ./gradlew bundleRelease   # génère un .aab pour le Play Store
```

Un release build nécessite une clé de signature — voir la documentation Expo
["App signing"](https://docs.expo.dev/app-signing/app-credentials/) ; EAS peut générer et gérer cette clé pour vous
(`eas credentials`).

### Build Android TV

Le config plugin `apps/mobile/plugins/withAndroidTv.js` patche automatiquement le manifeste lors du `prebuild`/build
EAS — aucune commande différente n'est nécessaire, le même APK s'installe sur téléphone/tablette et sur Android TV.
**Avant un premier build TV**, l’asset `apps/mobile/assets/images/tv_banner.png` (320×180) doit être présent —
il l’est depuis août 2026 (master `tv_banner-1280x720.png` à côté). Le plugin le copie en
`res/drawable/tv_banner.png` au prebuild.

## Backend (`apps/backend`)

```bash
cd apps/backend
cp .env.example .env
# éditez .env : identifiants PostgreSQL, JWT_SECRET, ENCRYPTION_KEY (obligatoires en production)
npm run build        # nest build -> dist/
npm run start:dev     # démarrage avec rechargement à chaud, DB_SYNCHRONIZE=true recommandé en dev
```

Vérification rapide une fois démarré :

```bash
curl http://localhost:3000/config
```

## Dashboard admin (`apps/admin`)

Fichier HTML unique, sans étape de build :

```bash
cd apps/admin
python3 -m http.server 5173   # ou tout serveur statique
# ouvrez http://localhost:5173, renseignez l'URL de votre backend, connectez-vous avec un compte isAdmin=true
```

## Lancer toute la suite de vérifications

```bash
npm run test:shared        # 43 tests unitaires (logique métier)
npm run typecheck          # tsc --noEmit sur tous les workspaces qui l'exposent
cd apps/backend && npm run build   # build NestJS complet
```
