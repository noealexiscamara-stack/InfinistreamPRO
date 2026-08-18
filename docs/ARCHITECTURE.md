# Architecture — décisions techniques

Ce document explique les choix structurants et pourquoi, pour qu'une reprise du projet (par un humain ou par Claude
dans une session future) n'ait pas à redécouvrir le raisonnement.

## 1. Monorepo npm workspaces

`apps/*` + `packages/*`, un seul `node_modules` hoisté à la racine. Pas de Turborepo/Nx : à ce stade (3 apps, 3
packages), la complexité d'un orchestrateur de build n'apporte rien — règle produit #58 (ne pas ajouter de complexité
sans valeur réelle pour le MVP). `packages/shared` contient toute la logique métier qui n'a pas besoin de React
Native pour exister : elle est donc testée avec `ts-jest` en Node pur, rapide (43 tests en ~2s), sans dépendre d'un
émulateur ni du preset `jest-expo`.

## 2. Pourquoi `packages/shared` plutôt que tout dans `apps/mobile`

Le parser M3U, le client Xtream, le parser EPG XMLTV, le parser de playlist maître HLS et
`AdaptiveStreamingManager` (l'algorithme de qualité adaptative) sont des fonctions pures ou des classes sans
dépendance React Native. Les isoler dans `packages/shared` permet :

- de les tester unitairement sans SDK Android ni simulateur (impossible dans cet environnement — voir
  LIMITATIONS.md) ;
- de les réutiliser côté `apps/backend` si un jour la validation de playlist doit se faire aussi côté serveur ;
- de garder `apps/mobile/src/services/*` comme une fine couche d'intégration React Native (SQLite, expo-video,
  expo-network) qui *appelle* cette logique plutôt que de la dupliquer.

## 3. Lecteur vidéo : expo-video (Media3) + parsing HLS applicatif

Le cahier des charges impose Android Media3/ExoPlayer. `expo-video` encapsule Media3 côté Android (et AVPlayer côté
iOS) — c'est donc le choix retenu plutôt qu'un module natif Kotlin écrit à la main, conformément à la règle #57
(stabilité > performance > simplicité : réutiliser une intégration Media3 mûre plutôt que réinventer la gestion bas
niveau du player).

**Limite connue et comment on la contourne** : à la date d'écriture, l'API JS d'`expo-video` n'expose pas de moyen de
contraindre le `TrackSelector` interne d'ExoPlayer (plafond de résolution/bitrate) ni de lire le débit mesuré segment
par segment. Deux conséquences :

- `packages/shared/src/hls/masterPlaylist.ts` parse nous-mêmes le manifeste HLS maître (`#EXT-X-STREAM-INF`) pour
  connaître le vrai palier de qualité offert par la source, puis `AdaptiveStreamingManager` choisit un rendu
  *précis* et donne son URL directe au lecteur — ce qui désactive de facto l'ABR interne d'ExoPlayer pour ce flux et
  nous rend le contrôle. C'est une technique standard, pas un hack fragile.
- La mesure de débit réel s'appuie sur le chronométrage du téléchargement du manifeste + la détection des
  rebufferings (transition d'état du lecteur), documentée dans `PlayerController.ts`. Une mesure fine par segment
  nécessiterait un petit module natif Expo lisant `BandwidthMeter` de Media3 — non fait ici, indiqué comme piste
  d'amélioration dans LIMITATIONS.md.

Quand la source ne fournit qu'un seul débit (pas de manifeste maître), `AdaptiveStreamingManager` devient un simple
passe-plat : **aucune qualité n'est jamais inventée** (règle produit #23), l'ABR éventuel reste alors entièrement
géré par ExoPlayer lui-même si le flux unique est en interne adaptatif côté serveur.

## 4. AdaptiveStreamingManager : hystérésis, pas un simple seuil

Voir `packages/shared/src/playback/AdaptiveStreamingManager.ts` et son fichier de tests. Points clés :

- **Estimateur de débit** (`ThroughputEstimator`) : moyenne harmonique glissante (pénalise les segments lents plus
  que la moyenne arithmétique ne le ferait — même biais que le `BandwidthMeter` d'ExoPlayer), lissée par EMA. Un
  événement de stall force immédiatement l'estimation à la baisse (pas d'attente que l'EMA "rattrape").
- **Descente rapide, montée prudente** : une dégradation peut sauter directement au palier sûr le plus haut
  disponible (réactivité), alors qu'une amélioration doit être *soutenue* (fenêtre d'observation, `isStable`
  requis) avant d'être tentée, et ne monte qu'un palier à la fois. C'est ce qui empêche l'oscillation
  720p↔480p↔720p explicitement interdite par la règle produit #22 — testé dans
  `AdaptiveStreamingManager.test.ts` ("does not oscillate").
- **4 profils de mode** (`qualityModeProfiles.ts`) : AUTO/ÉCONOMIE/ÉQUILIBRÉ/QUALITÉ ne sont pas de simples labels,
  ce sont des jeux de seuils différents (marge de descente, marge de montée, fenêtre d'observation, plafond de
  résolution) — testé explicitement (comparaison ÉCONOMIE vs QUALITÉ face au même déclin de débit).
- **Cooldown** entre deux changements, sauf appel explicite `forceImmediate` (utilisé pour les stalls et les
  changements de mode utilisateur, qui doivent être immédiats).

## 4bis. Reconstruire un palier de qualité quand la source n'en déclare aucun

C'est la réponse au cas le plus fréquent en Afrique de l'Ouest (et sur beaucoup de fournisseurs bas de gamme) : le
flux n'est pas adaptatif du tout, mais le fournisseur livre la même chaîne en plusieurs entrées M3U indépendantes —
`TF1 SD`, `TF1 HD`, `TF1 FHD`. Un lecteur classique affiche trois chaînes distinctes et ne peut jamais s'adapter.

`packages/shared/src/channels/` reconstruit l'échelle :

- `qualityMarkers.ts` lit le suffixe de qualité dans le nom (SD/HD/FHD/UHD/4K/1080p/LQ/HQ, formes entre crochets ou
  parenthèses, séparateurs variés). Deux règles de prudence volontaires, parce qu'une fusion abusive fait
  *disparaître* une chaîne de la liste — bien pire qu'un regroupement manqué : un marqueur nu n'est retiré qu'en
  **fin** de nom (`TF1 HD` → `TF1`, mais `Discovery HD Showcase` et `HDNet` sont laissés intacts), et un nombre nu
  n'est **jamais** lu comme une résolution (`beIN Sports 1`, `Canal+ Sport 360` restent entiers).
- `groupChannels.ts` regroupe ensuite par nom normalisé, puis re-sépare par `tvg-id` (même nom + `tvg-id` différent =
  flux régionaux différents, ex. `TF1.fr` vs `TF1.be`). Invariant testé : **aucune chaîne n'est jamais perdue** —
  la somme des paliers + les doublons exacts d'URL égale toujours le nombre d'entrées en entrée. Deux entrées au
  *même* palier sont conservées toutes les deux : ce sont des URL de secours sur un autre serveur, ce qui est un
  vrai gain de robustesse quand une origine tombe.

## 4ter. Deux boucles d'adaptation, pas une

Une fois l'échelle reconstruite, il y a deux niveaux d'adaptation, avec des coûts très différents :

| | Boucle interne | Boucle externe |
|---|---|---|
| Classe | `AdaptiveStreamingManager` | `ChannelTierSwitcher` |
| Change quoi | un rendu à l'intérieur d'un même flux HLS | l'URL du flux entièrement |
| Coût d'un changement | transparent | reconnexion, ~1-2 s d'écran noir |
| Rythme | quelques secondes | dizaines de secondes |

`ChannelTierSwitcher` est donc réglé bien plus prudemment (`DEFAULT_TIER_SWITCH_CONFIG` : 20 s de maintien minimum,
90 s de débit confortable avant de monter). Trois choix spécifiquement pensés pour une connexion instable :

- **Asymétrie descente/montée.** Se tromper en descendant coûte une image un peu plus douce ; se tromper en montant
  coûte un stall *puis* une seconde reconnexion pour redescendre. La descente est donc rapide, la montée doit faire
  ses preuves.
- **Mémoire des échecs.** Chaque fois qu'un palier nous a lâchés, le temps de stabilité exigé pour y revenir
  augmente (`demotionPenaltyMs`, plafonné). Une connexion qui oscille converge vers un palier tenable au lieu de
  faire l'ascenseur.
- **Première correction immédiate.** Le palier d'ouverture n'est qu'une supposition : le cooldown ne s'applique
  qu'à partir du *premier* changement, pour ne pas imposer 20 s de stall au démarrage.

Enfin, `reportTierDead()` distingue un flux **mort** (404, timeout, codec) d'un flux **lent** : on bascule d'abord
sur une autre URL du même palier avant de sacrifier de la qualité.

## 5. Stockage local : SQLite (relationnel, volumineux) + MMKV (clé/valeur, réglages)

Les chaînes d'une playlist peuvent se compter en milliers ; elles vivent dans SQLite (`apps/mobile/src/utils/db.ts`)
avec des index sur `(sourceId)` et `(sourceId, category)`, et une recherche `LIKE ... COLLATE NOCASE` indexée sur le
nom. Les imports M3U/Xtream écrivent par lot dans une transaction unique (`prepareAsync` + `executeAsync` répété)
plutôt que ligne par ligne hors transaction, pour rester rapide sur de grandes playlists (règle produit #14/#54).
Les réglages (mode qualité, onboarding terminé, mode connexion faible) vivent dans MMKV — lecture/écriture
synchrone, pas besoin de relationnel pour une poignée de clés.

## 6. Parsing M3U non bloquant

`packages/shared/src/m3u/parser.ts` expose un générateur synchrone (`iterateM3uChannels`, testable simplement) et un
parseur asynchrone chunké (`parseM3u`) qui rend la main à la boucle d'événements tous les *N* canaux (`chunkSize`,
défaut 500) via `await new Promise(setTimeout)`. Sur un moteur JS mono-thread comme Hermes, cela ne parallélise pas
le calcul mais laisse respirer les mises à jour d'UI/gestes entre deux tranches — testé avec une playlist simulée de
5000 chaînes.

## 7. Backend : NestJS modulaire, pas de microservices

Un seul service NestJS avec des modules bien séparés (`auth`, `users`, `subscriptions`, `payments`, `devices`,
`playlists`, `sync`, `notifications`, `analytics`, `admin`) — conforme à la règle produit #45 ("ne pas créer de
microservices inutilement complexes pour le MVP"). PostgreSQL via TypeORM, `synchronize: true` en développement
uniquement (voir GUIDE_DEPLOIEMENT.md pour les migrations en production).

- **Paiements** (`payments/`) : interface `PaymentProviderAdapter` commune, trois implémentations stub (Orange
  Money, MTN MoMo, HoloPay) — voir LIMITATIONS.md, aucune n'a de vraies clés marchand dans cet environnement, mais
  la structure (initiate → webhook → activation serveur) est en place et *ne considère jamais une confirmation
  côté client comme suffisante* (règle produit #41) : seul un webhook vérifié active `SubscriptionsService`.
- **Sync** (`sync/`) : favoris/historique synchronisés comme un blob JSON opaque par utilisateur et par type
  (dernier écrit gagne), pas un schéma relationnel dupliqué côté serveur — la copie relationnelle détaillée vit déjà
  en local sur l'appareil (SQLite), le serveur n'a pas besoin de la requêter, juste de la transporter entre
  appareils.
- **Playlists** (`playlists/`) : stocke uniquement la *référence* à la source (URL, ou serveur+utilisateur+mot de
  passe Xtream chiffré) pour la synchronisation multi-appareils Premium — jamais la liste de chaînes elle-même
  (des milliers d'entrées, bon marché à re-télécharger depuis la source d'origine, et cohérent avec le positionnement
  "Infiny Stream ne redistribue pas de contenu").
- **Sécurité** : mots de passe utilisateur hachés (`bcrypt`, 12 rounds) ; mot de passe Xtream chiffré at-rest
  (AES-256-GCM, `common/crypto.util.ts`) plutôt qu'en clair (règle produit #46) ; `passwordHash` exclu de toute
  réponse JSON via `class-transformer` + `ClassSerializerInterceptor` global ; `ValidationPipe` global
  (`whitelist`, `forbidNonWhitelisted`) contre les payloads malformés.
- **Configuration jamais codée en dur côté client** (règle #38) : `GET /config` sert prix/devise/durée d'essai/limite
  d'appareils depuis les variables d'environnement du serveur ; le mobile ne garde qu'un `FALLBACK_PRICING_CONFIG`
  local *documenté comme tel* pour ne pas afficher un écran vide avant le premier appel réseau.
- **Admin** (`admin/`) : accès gardé par `AdminGuard`, qui exige un compte réel avec `isAdmin = true` en base plutôt
  qu'une clé statique partagée — révocable par utilisateur.

## 8. Android TV

Le template Expo managé ne pose pas nativement la catégorie `LEANBACK_LAUNCHER` ni `android:banner` sur le manifeste
généré. `apps/mobile/plugins/withAndroidTv.js` est un config plugin Expo qui patche `AndroidManifest.xml` au moment
du `prebuild`/build EAS pour ajouter ces éléments — voir LIMITATIONS.md pour ce qui reste à faire (navigation D-pad
et focus visuel n'ont pas pu être testés faute d'émulateur Android TV disponible ici).
