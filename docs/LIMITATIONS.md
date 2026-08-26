# Limitations connues

Document honnête de ce qui **n'est pas fait**, ce qui **n'a pas pu être testé dans cet environnement**, et ce qui
reste à faire avant une mise en production. À lire avant de considérer une fonctionnalité "terminée" — conformément
à la règle produit #57 : *"Ne considère jamais une fonctionnalité terminée simplement parce que le code compile."*

## Contrainte d'environnement (pourquoi ces limites existent)

Cette passe de développement s'est déroulée dans un sandbox cloud **sans SDK Android, sans émulateur, sans écran**.
Concrètement :

- `ANDROID_HOME` n'est pas configuré, aucun `sdkmanager`/`adb` n'est installé.
- Pas d'affichage (headless) : impossible de lancer un émulateur Android même en installant le SDK.
- Le backend NestJS, lui, **a pu être testé en conditions réelles** (PostgreSQL local disponible dans ce sandbox) —
  voir README.md pour le détail des appels HTTP vérifiés.

Ce qui suit distingue donc "écrit et raisonné avec soin" de "vérifié en exécution réelle".

## 1. Lecture vidéo réelle — NON TESTÉE EN EXÉCUTION

`apps/mobile/src/services/playback/PlayerController.ts` et l'écran `app/player/[channelId].tsx` pilotent un vrai
`VideoPlayer` `expo-video` (Media3 sur Android). Le code compile et son raisonnement est documenté en commentaires,
mais **rien ici n'a pu être exécuté sur un appareil ou un émulateur** :

- Lecture effective d'un flux HLS/TS réel (master passé tel quel à ExoPlayer — ABR natif).
- Détection d'erreur via `statusChange` d'expo-video — à revérifier sur appareil réel (`expo-video ~57.0.2`).
- Stabilité > 10 minutes sur bonne connexion (critère d'acceptation produit).
- Reconnexion automatique après erreur réelle du lecteur (pas après estimation de débit).
- Chromecast (Premium optionnel, non implémenté).

**Prochaine étape recommandée** : `expo prebuild` + build de développement (`eas build --profile development` ou
Android Studio local) puis test manuel sur un appareil bas de gamme réel avec un flux IPTV légitime, en suivant la
matrice de tests réseau du cahier des charges (Wi-Fi excellent/moyen/faible, 3G/4G divers, perte/latence).

## 1b. Lecteur — plein écran immersif NON VÉRIFIÉ SUR APPAREIL

Le lecteur occupe tout l'écran pour la **vidéo** (pas de `ScreenSafeArea` sur la surface).
Les **contrôles** (retour, favori, barre du bas) appliquent `useSafeAreaInsets` — image
bord à bord, commandes dans les marges sûres.

Masquage des barres système via `expo-status-bar` + `expo-navigation-bar`
(`NavigationBar.setHidden` / `setVisibilityAsync`) : **appelé**, mais **pas confirmé
visuellement** depuis cet environnement (pas d'appareil). Sur Android 15+ le mode
bord-à-bord est imposé et ces API peuvent être inopérantes selon l'OEM / la config
Expo — un appel sans erreur ne prouve pas que la barre a disparu. À valider sur
appareil réel : contrôles masqués → la barre de navigation Android doit disparaître
vraiment ; sinon documenter l'échec et ne pas prétendre au plein écran immersif.

## 2. ABR natif ExoPlayer — plafond qualité non exposé par expo-video

`PlayerController` passe le **manifeste HLS maître** à `expo-video` / Media3. L'adaptation de débit est faite
par ExoPlayer sur les segments réels (comme IBO / IPTV Smarters). On ne sélectionne plus de variante en JS et
on ne mesure plus le débit via le téléchargement d'un manifeste (~2 Ko).

Ce que `expo-video` (~57.x) expose réellement côté JS :

- `bufferOptions` (durée de tampon avant, seuil de démarrage, plafond d'octets) — **seul levier** des modes
  Économie / Équilibré / Qualité (libellés UI alignés là-dessus) ;
- `availableVideoTracks` / `videoTrack` / événement `videoTrackChange` — **lecture seule** ; la barre d'état
  et le lecteur affichent la hauteur réelle de la piste (`1080p FHD`, etc.) ou `—` hors lecture ;
- **aucun** `maxBitrate` / `maxHeight` / `preferredPeakBitRate`.

Sans module natif (TrackSelectionParameters Media3), le mode utilisateur **ne peut pas** imposer un plafond de
résolution. Ne pas réintroduire de libellés ou de logique qui suggèrent le contraire. « Hors ligne » vient
uniquement de la connectivité système (`expo-network`), jamais d'une estimation de débit.

Les échecs de lecture sont journalisés dans **Réglages → Diagnostic lecture** (code / message expo-video,
URL, durée avant panne). expo-video n'expose pas toujours le code ExoPlayer natif complet — le champ
`rawErrorJson` capture tout ce que le bridge JS renvoie. Le même écran affiche les compteurs
**sources ouvertes / libérées / actives** (sans adb) : en régime normal `actives` doit rester ≤ 1.

### Compromis zapping / stabilité (tampon de démarrage)

Build de validation (août 2026) : mode `auto` utilise `minBufferForPlayback = 8 s` (et ~30 s
d'avance). Objectif : prouver que les coupures segmentaires (5–7 s) disparaissent quand les
slots fournisseur sont correctement libérés **et** que le démarrage n'est plus en famine.

Ce seuil de **démarrage** est volontairement généreux et **à affiner après mesure** sur tablette
réelle : dès que la lecture reste stable, redescendre par paliers (**6 s**, puis **4 s**) pour
rapprocher le zapping des 2–3 s attendues en TV live. Le tampon d'**avance** (`preferredForwardBufferDuration`
≈ 30 s) peut rester généreux — ce n'est pas lui qui fait attendre la première image.

**Prochaine étape recommandée** : module Expo Kotlin exposant un plafond bitrate/hauteur Media3 si le produit
exige un vrai plafond Économie (480p) côté lecteur.

## 3. Android TV — manifeste patché, focus non testé

Le config plugin `apps/mobile/plugins/withAndroidTv.js` ajoute `LEANBACK_LAUNCHER` et `android:banner` au manifeste
généré. Non fait / non testé :

- Le drawable `@drawable/tv_banner` référencé par le plugin **n'existe pas encore** — à fournir (image 320×180)
  avant un premier build TV, sinon le build natif échouera à la résolution de ressource.
- Navigation D-pad et style de focus visuel sur les listes/boutons (le style `pressed` actuel des composants suppose
  une interaction tactile ; un vrai passage TV doit ajouter `focusable`/`hasTVPreferredFocus` et un style de focus
  visible, non fait dans cette passe).
- Aucun test sur émulateur/téléviseur Android TV réel n'a pu être effectué (pas d'émulateur disponible ici).

## 4. Paiements — stubs structurels, aucune intégration réelle

`OrangeMoneyProvider`, `MtnMomoProvider`, `HoloPayProvider` (`apps/backend/src/payments/providers/`) suivent la
forme attendue (initiate → redirectUrl, verifyWebhook → statut) mais **aucun appel réseau réel n'est implémenté** :
aucun des trois n'a de documentation d'API/credentials marchand disponible dans cet environnement. Chaque stub lève
une erreur explicite (503) plutôt que de simuler un succès silencieux — pour ne jamais laisser croire qu'un paiement
a réussi alors qu'il n'a pas été traité.

**Prochaine étape recommandée** : obtenir les identifiants marchand + documentation API de chaque fournisseur,
implémenter `initiate()`/`verifyWebhook()` sans changer l'interface `PaymentProviderAdapter` ni `PaymentsService`.

## 5. Notifications push — stub qui journalise seulement

`NotificationsService` (`apps/backend/src/notifications/`) journalise ce qu'il enverrait ("abonnement expire
bientôt", etc.) sans jamais réellement notifier — pas d'intégration FCM/APNs, pas de gestion de token push côté
mobile. Prochaine étape : `expo-notifications` côté mobile + un provider FCM/APNs côté serveur.

## 6. Dashboard admin — un seul écran (KPI), pas de gestion détaillée

`apps/admin/index.html` est une page unique fonctionnelle (connexion + KPI de `GET /admin/dashboard`, vérifiée via
les mêmes appels HTTP que le reste du backend). Le cahier des charges section 47 demande aussi des écrans
Utilisateurs / Abonnements / Paiements / Configuration détaillés — **les endpoints n'existent pas encore côté
backend** (seul `/admin/dashboard` a été implémenté), et il n'y a pas d'écran dédié pour les créer/modifier.

## 7. Génération d'APK — non réalisable dans ce sandbox

Aucun APK (debug ou release) n'a été généré : cela nécessite le SDK Android (absent ici) ou un service de build cloud
comme EAS Build. Voir `docs/GUIDE_BUILD.md` pour la marche à suivre une fois hors de ce sandbox.

## 8. Compte utilisateur côté mobile — pas encore connecté au backend

Les écrans `app/account` et `app/subscription` du mobile affichent un état **local uniquement** (essai de 30 jours
suivi par MMKV, aucun appel réseau vers `apps/backend`). Le backend expose déjà `/auth/register`, `/auth/login`,
`/subscriptions/me`, `/devices`, `/payments/initiate` — le câblage mobile↔backend (écran de connexion/inscription,
stockage sécurisé du token JWT, appel réel à `/subscriptions/me` au démarrage plutôt que la classe `localTrial.ts`)
reste à faire. C'est indiqué explicitement dans `services/subscription/localTrial.ts`.

## 10. TypeScript `ignoreDeprecations` (packages/shared + packages/config)

Après le passage de TypeScript **6.0.3 → 5.9.3** (alignement peer `ts-jest`),
`packages/shared/tsconfig.json` et `packages/config/tsconfig.json` déclarent :

```json
"moduleResolution": "Node10",
"ignoreDeprecations": "5.0"
```

### Quoi exactement ?

`moduleResolution: "Node10"` (anciennement nommé `"node"`) est **déprécié** depuis
TypeScript 5.0. Sans `ignoreDeprecations`, `tsc` échoue avec `TS5107` /
`TS5103` selon la version. L'option `ignoreDeprecations: "5.0"` **supprime
l'erreur** pour les dépréciations introduites en TS 5.0 — ce n'est **pas** une
migration vers `Node16` / `Bundler`.

Aucune autre option dépréciée n'est volontairement masquée aujourd'hui.

### Prochaine montée de TypeScript

- Si on remonte à **TS 6.x** : la valeur `"5.0"` peut devenir invalide
  (`TS5103: Invalid value for '--ignoreDeprecations'`) — déjà vu en
  redescendant de 6.0.3. Il faudra alors soit migrer
  `moduleResolution` vers `"Node16"` / `"Bundler"`, soit ajuster
  `ignoreDeprecations` à la valeur supportée par cette majeure.
- Ne **pas** considérer le typecheck vert comme une preuve que
  `moduleResolution` est à jour. Dette technique assumée jusqu'à une passe
  dédiée (chemins ESM, `exports` des packages workspace).

## 11. Taille APK locale ~120 Mo — APK universel 4 ABI

L'APK de build locale `assembleRelease` embarque **toutes** les architectures
natives (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) — confirmé via
`aapt dump badging` (`native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'`).
C'est la cause principale du volume (~120 Mo) face à Smarters/IBO (~74–78 Mo)
qui livrent souvent des splits par ABI ou un AAB Play.

**Publication Play Store** : le profil EAS `production` doit produire un
**AAB** (`buildType: app-bundle`). Play découpe alors le téléchargement par
ABI — taille réelle sur appareil ≈ **¼ à ½** de l'APK universel selon le
SoC (typiquement arm64 seul). Les APK `preview` / locaux restent universels
pour installation sideload simple.

## 12. Ce qui a été vérifié à l'exécution (pour équilibrer le tableau)

- **43/43 tests unitaires verts** sur `packages/shared` (parser M3U, client Xtream, parser EPG XMLTV, parser HLS,
  estimateur de débit, `AdaptiveStreamingManager` — y compris le test anti-oscillation 720p/480p).
- **`tsc --noEmit` sans erreur** sur `packages/types`, `packages/shared`, `packages/config`, `apps/mobile`,
  `apps/backend`.
- **Backend démarré contre une vraie base PostgreSQL** dans ce sandbox, et testé par de vraies requêtes HTTP :
  inscription (avec essai gratuit auto-créé), connexion, exclusion du hash de mot de passe des réponses, limite
  d'appareils (403 au 3ᵉ appareil avec une limite à 2), garde admin (403 sans le rôle, 200 avec), stub de paiement
  (503 explicite), ingestion d'un événement analytics, calcul des KPI admin.
