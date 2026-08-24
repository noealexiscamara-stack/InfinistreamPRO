# Infiny Stream

**Le streaming qui s'adapte à votre connexion.**

Infiny Stream est un lecteur IPTV — pas un fournisseur de chaînes. L'application permet à l'utilisateur de charger ses
propres sources IPTV auxquelles il a légalement accès (playlists M3U, fichiers M3U, Xtream Codes, flux directs), et se
distingue par une adaptation intelligente à la qualité réelle de la connexion, pensée d'abord pour les réalités réseau
africaines.

1 mois d'essai gratuit, puis 5 €/an (configurable côté serveur, jamais codé en dur côté client).

## Structure du monorepo

```
infiny-stream/
  apps/
    mobile/    Application Android/Android TV — Expo + React Native + TypeScript
    backend/   API NestJS + PostgreSQL (comptes, abonnements, paiements, sync, admin)
    admin/     Dashboard d'administration (page statique, appelle l'API backend)
  packages/
    types/     Types TypeScript partagés (Channel, Source, Subscription, ...)
    shared/    Logique métier pure et testée : parser M3U, client Xtream, parser
               EPG XMLTV, parser de playlist HLS, estimateur de débit,
               AdaptiveStreamingManager (algorithme de qualité adaptative)
    config/    Constantes partagées (avec avertissement : le backend reste la
               source de vérité pour le prix/essai/limite d'appareils)
  docs/
    ARCHITECTURE.md    Décisions techniques et pourquoi
    LIMITATIONS.md     Ce qui n'est pas fait / pas testable dans cet environnement
    BUILD_LOCAL.md     APK Android local (keystore EAS) + émulateur
    GUIDE_BUILD.md     Packages, backend, EAS cloud
    GUIDE_DEPLOIEMENT.md  Comment déployer le backend et publier l'app
    GUIDE_VPS.md       Pas-à-pas déploiement sur un VPS (Docker + Nginx + Let's Encrypt)
```

## État du projet (voir docs/LIMITATIONS.md pour le détail)

Ce qui est **écrit, testé, et vérifié en exécution réelle** dans cette passe :

- Le parser M3U (robuste, asynchrone/chunké pour les grandes playlists), le client Xtream Codes, le parser EPG XMLTV,
  le parser de playlist maître HLS, et l'algorithme `AdaptiveStreamingManager` (hystérésis, 4 modes de qualité,
  jamais de qualité inventée) — **43 tests unitaires, tous verts** (`packages/shared`).
- L'application mobile (écrans, navigation, stockage local SQLite + MMKV, services M3U/Xtream/réseau/lecture) —
  **compile sans erreur TypeScript** sur l'ensemble du projet.
- Le backend NestJS (auth, essai gratuit automatique, abonnements, appareils avec limite configurable, paiements
  (stubs), synchronisation, analytics, administration) — **compile, démarre, et a été testé de bout en bout contre
  une vraie base PostgreSQL** dans cet environnement (inscription, connexion, essai gratuit, limite d'appareils,
  garde admin — tous vérifiés par de vraies requêtes HTTP).
- Le dashboard admin (page unique) — appelle l'API réelle, logique vérifiée par relecture et par les mêmes tests
  HTTP que ci-dessus.

Ce qui **nécessite un appareil/émulateur Android réel** pour être validé (impossible dans ce sandbox cloud sans SDK
Android ni écran — voir docs/LIMITATIONS.md) :

- La lecture vidéo réelle (Media3/ExoPlayer via expo-video), le changement de qualité en conditions réseau réelles,
  la reconnexion automatique, le focus Android TV, les performances sur appareil bas de gamme.
- La génération d'un APK Debug/Release (nécessite EAS Build ou Android Studio + SDK).

## Démarrage rapide

```bash
npm install               # à la racine — installe tout le monorepo (workspaces npm)
npm run test:shared       # 43 tests unitaires sur la logique métier partagée
cd apps/mobile && npm run start   # démarre Metro / Expo Go
cd apps/backend && cp .env.example .env && npm run start:dev  # nécessite PostgreSQL
```

Voir `docs/GUIDE_BUILD.md` pour la suite (build natif, APK).
