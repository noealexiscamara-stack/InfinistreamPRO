# Étude de faisabilité — Android TV / Fire TV

**Date** : 26 août 2026  
**Commit de référence mobile** : `e0fdce5` (en test tablette ; hors scope de cette étude)  
**Nature** : document uniquement — aucune dépendance, aucun fichier de build, aucune branche d’essai, aucun code.  
**Durée cible** : ≤ 3 h.  
**Lot B** : reste **bloqué**.  
**Hors scope immédiat** : la partie « composants pensés pour le focus » du même addendum — **ne démarre pas** tant que le lot B n’a pas le feu vert.

---

## 1. Verdict

| Objectif | Faisable ? | Condition |
|---|---|---|
| Faire apparaître l’APK actuel dans un launcher Leanback (sideload) | **Oui** | `tv_banner.png` 320×180 présent ; plugin manifeste déjà câblé |
| Naviguer / regarder correctement à la télécommande (produit TV) | **Oui, vérifié côté fork** | `react-native-tvos@0.86.2-0` = même patch RN que le projet (`0.86.2`) ; + focus UI (post lot B) |
| Réutiliser le backend d’appairage | **Oui** | Backend prêt ; client mobile incomplet (`/poll` + session) — **bug produit Accueil dès aujourd’hui**, pas un sujet TV |
| Un seul binaire phone+TV « product-ready » sans profils séparés | **Risqué / déconseillé** | Expo recommande des profils EAS distincts (`EXPO_TV=1`) ; le monorepo impose d’aligner `react-native` partout si on bascule |

**Go / no-go produit**

- **GO technique** pour une **phase TV** après validation tablette + lot B UI : le chiffre de fork est aligné (voir §2.7) ; le risque n°1 restant est le **chrome lecteur** (voir §2.6), pas l’absence de package npm.
- **NO-GO** de considérer le plugin `withAndroidTv` actuel comme « Android TV prêt » : il couvre le **manifeste / launcher**, pas l’**expérience télécommande**.
- **NO-GO immédiat** sur implémentation (deps, focus, builds TV) pendant le test `e0fdce5` et tant que le lot B est bloqué.

---

## 2. Ce que le dépôt a déjà

### 2.1 Manifeste Leanback (partiel)

`apps/mobile/plugins/withAndroidTv.js` (branché dans `app.json`) au `prebuild` / EAS :

- `android.software.leanback` **required=false** (installe aussi phone/tablette)
- `android.hardware.touchscreen` **required=false**
- catégorie `LEANBACK_LAUNCHER` sur l’activité principale
- `android:banner` → `@drawable/tv_banner`
- copie `assets/images/tv_banner.png` → `res/drawable/tv_banner.png`

Documenté aussi dans `ARCHITECTURE.md` §8, `GUIDE_BUILD.md`, `LIMITATIONS.md` §3.

### 2.2 Bannière Leanback — bloquant levé

Assets livrés (août 2026) :

| Fichier | Rôle | Taille |
|---|---|---|
| `apps/mobile/assets/images/tv_banner.png` | Drawable copié par le plugin (`@drawable/tv_banner`) | **320×180** |
| `apps/mobile/assets/images/tv_banner-1280x720.png` | Master source (non référencé au build) | **1280×720** |

Le prebuild n’est plus bloqué par l’absence d’asset. Un vieux `tv_banner` 1024×1024 (copie d’icône) ne doit plus être réintroduit.

### 2.3 Orientation

`app.json` : `"orientation": "landscape"` — déjà aligné avec un usage TV / tablette paysage.

### 2.4 Appairage — backend prêt ; carte Accueil = promesse non tenue

| Couche | État |
|---|---|
| Backend `apps/backend/src/pairing/` (RFC 8628-like) | **Prêt** : start / poll / approve / deny, secret appareil, TTL 10 min, limite d’appareils, tests |
| Plateforme `android_tv` dans `@infiny-stream/types` + devices | **Prêt** |
| Mobile `startPairing` + détection `Device.DeviceType.TV` → `android_tv` | **Partiel** (`usePairingSession`) |
| Mobile `POST /pairing/poll` + persistance `accessToken` | **Absent** |
| `PhonePairingCard` sur l’Accueil | Affiche QR + code 6 caractères **aujourd’hui** |

Ce n’est **pas** un sujet TV : la carte est sur le premier écran phone/tablette. Voir **§11** pour le parcours utilisateur réel et l’implication lot B (finir le flux **ou** masquer la carte).

### 2.5 UI tactile uniquement

Composants interactifs (`Button`, `ChannelRow`, lecteur, etc.) : `Pressable` + style `pressed`.  
Aucun `onFocus` / `focused`, pas de `TVFocusGuideView`, pas de parcours D-pad validé.  
C’est exactement le chantier « composants pensés pour le focus » — **reporté après feu vert lot B**.

### 2.6 Lecteur et overlays — risque technique n°1 (précision)

`expo-video` ~57.0.2 est dans la liste des modules Expo supportés sur TV.  
Infiny force déjà `nativeControls={false}` (`PlayerVideoSurface`) : **toute** la UI de commande est un overlay React Native par-dessus `VideoView` (zones haut/centre/bas, scrubber VOD, gestes).

#### Que voulait dire « overlays non supportés » ?

**Pas** : « impossible de dessiner des vues au-dessus de la vidéo ».  
Un `View` / `Pressable` en `absoluteFill` au-dessus de `VideoView` **se rend** sur Android TV comme sur phone — pas d’invisibilité systématique, pas d’interdiction de composition.

**Oui, en pratique** (ce qui casse le produit) :

| Problème | Effet exact |
|---|---|
| Chrome actuel branché sur `pressed` + `PlayerGestureLayer` (tactile) | À la télécommande : pas de style focus visible ; taps D-pad ≠ gestes ; commandes souvent **inutilisables** même si visibles |
| `VideoView` peut **voler le focus** D-pad | Issue Expo [#40264](https://github.com/expo/expo/issues/40264) : le focus quitte les `Pressable` pour la surface vidéo malgré `focusable={false}` / `isTVSelectable={false}` (repro TV ; contournements via `TVFocusGuideView` / props accessibilité documentés côté communauté) |
| Contrôles natifs ExoPlayer | Non utilisés chez nous (`nativeControls={false}`) — bonne base TV, à conserver |

Donc : overlays = **rendus possibles**, **interaction télécommande non assurée** avec le code actuel. Ce n’est ni « couche fantôme », ni « API absente » — c’est **focus + input model**.

#### Solution retenue par les apps TV React Native

Pattern industriel (Netflix-like / guides Fire TV / exemples `react-native-tvos`) :

1. Surface vidéo **non focusable** (et guide de focus autour).
2. Contrôles **custom en JS** : `Pressable` / `Touchable*` en overlay, styles `focused` / `pressed`, `hasTVPreferredFocus` sur le play.
3. Conteneurs `TVFocusGuideView` pour piéger le D-pad dans la barre de commandes.
4. `useTVEventHandler` seulement pour touches media (play/pause, back) — pas pour tout le layout.
5. **Ne pas** s’appuyer sur les contrôles natifs du player pour l’UX produit.

#### Conséquence chiffrée pour Infiny

| Partie du lecteur | Réutilisable tel quel sur TV ? |
|---|---|
| `PlayerController`, URLs, qualité, keep-awake, diagnostics | **Oui** (moteur) |
| `PlayerVideoSurface` (`VideoView`, `nativeControls={false}`) | **Oui**, avec durcissement focus surface |
| Overlay commandes Lot A (haut/centre/bas, scrubber, lock) | **Non tel quel** — à adapter focus / D-pad (chantier focus post lot B) |
| `PlayerGestureLayer` | **Non** sur TV — remplacer par focus + touches remote |

**Verdict lecteur** : **partiellement réutilisable** (~ couche lecture / métier : oui ; ~ couche chrome : à refaire pour TV, pas à jeter le fichier entier). Estimation indicative : **réécriture du chrome**, pas du pipeline playback.

### 2.7 Chiffre exact — `react-native-tvos` vs RN du projet

Relevé npm + table Expo SDK 57 (août 2026) :

| Élément | Valeur |
|---|---|
| Expo SDK projet | **57** (`expo ~57.0.14`) |
| `react-native` projet (amont) | **0.86.2** |
| Tag Expo / npm à installer | `react-native-tvos@**0.86-stable**` |
| Version **publiée** résolue par ce tag | **`0.86.2-0`** |
| RN amont dont le fork dérive | **0.86.2** (schéma `0.xx.y-z` : `y` = patch RN, `z` = patch fork) |
| Retard vs RN utilisé par Infiny | **Aucun** sur la ligne 0.86.2 (`0.86.2-0` ≡ même base que `0.86.2`) |

Le tag `latest` npm pointe vers **0.87.0-0** (ligne 0.87) — **ne pas** l’utiliser avec SDK 57.

| Élément build | Aujourd’hui | Voie Expo officielle TV |
|---|---|---|
| Dépendance | `"react-native": "0.86.2"` | `"react-native": "npm:react-native-tvos@0.86.2-0"` (ou `@0.86-stable`) |
| Config plugin TV | `./plugins/withAndroidTv` | + `@react-native-tvos/config-tv` + `EXPO_TV=1` |
| Profils EAS | `development` / `preview` / `production` | + `*_tv` avec `env.EXPO_TV=1` |
| Monorepo | un mobile Expo | Aligner **tous** les apps Expo du monorepo sur le même package RN-TV |

Sources : [registry npm `react-native-tvos` dist-tags](https://www.npmjs.com/package/react-native-tvos), [Expo SDK versions — React Native TV](https://docs.expo.dev/versions/latest/), [Build apps for TV](https://docs.expo.dev/guides/building-for-tv/).

---

## 3. Deux niveaux de « support TV » (ne pas les confondre)

### Niveau A — Installabilité launcher

**But** : l’APK s’installe sur stick / box, icône/banner dans le launcher Leanback.  
**Coût** : asset banner + éventuellement conserver le plugin actuel.  
**Résultat** : l’app **ouvre**, mais la navigation D-pad reste hasardeuse / invisible.  
**Utile pour** : smoke test sideload, pas pour une release produit TV.

### Niveau B — Produit TV (cible réelle)

**But** : focus visible, listes / onglets / lecteur pilotables à la télécommande, appairage code, lecture live/VOD stable.  
**Coût** : bascule `react-native-tvos` + profils EAS TV + client pairing complet + chantier focus UI (post lot B) + tests émulateur Android TV / stick réel.  
**Résultat** : candidat Play / Amazon / sideload Premium.

Cette étude recommande de **ne jamais livrer le niveau A comme « Android TV supporté »** dans la com produit.

---

## 4. Contraintes et risques majeurs

### 4.1 Fork `react-native-tvos` (risque principal)

Sans ce fork, le focus engine / APIs TV React Native ne sont pas au niveau documenté par Expo.  
Impacts :

- rebuild natif obligatoire (`prebuild --clean`)
- risque de régression phone/tablette à revalider (A1–A3, import, keep-awake…)
- monorepo : alignement unique de `react-native`
- deps tierces : vérifier `react-native-gesture-handler`, `react-native-screens`, `react-native-reanimated`, `react-native-mmkv`, `expo-document-picker` sur [React Native Directory TV](https://reactnative.directory/?tvos=true)

**Mitigation** : profils EAS `preview_tv` / `development_tv` séparés ; ne pas mélanger le canal de distribution tablette et TV tant que la matrice n’est pas verte.

### 4.2 Plugin maison vs `@react-native-tvos/config-tv`

Le plugin actuel et le plugin officiel se **chevauchent** (Leanback / orientation).  
Au moment d’ouvrir le chantier TV, trancher :

- garder `withAndroidTv` **uniquement** pour la copie banner custom, **ou**
- fusionner banner dans le flux officiel et retirer le doublon manifeste

Ne pas empiler les deux sans audit de manifeste.

### 4.3 Saisie clavier / sources

Sur TV, taper URL Xtream / M3U / email / PIN parental avec D-pad est pénible.  
L’appairage backend existe **précisément** pour ça. Priorité TV :

1. appairage code (auth + sync compte)
2. import / sources initiés depuis le téléphone (déjà le récit produit)
3. PIN parental : clavier numérique système ou pad on-screen focusable (à designer post lot B)

`expo-document-picker` pour un fichier M3U local sur stick : faisabilité douteuse / UX faible — ne pas en faire le chemin principal TV.

### 4.4 Fire TV (Amazon)

Fire OS ≈ Android + launcher Amazon.  
Leanback + sideload couvrent souvent le smoke test.  
Publication Amazon Appstore = packaging / review séparés (hors scope aujourd’hui).  
Pas de raison de forker le code métier phone↔Fire ; même socle Android TV + tests sur stick Fire.

### 4.5 Performance / catalogue

Catalogue ~284k entrées déjà stressé sur tablette. Sur stick (souvent 2–4 Go RAM) :

- listes virtualisées obligatoires (déjà le cas côté FlatList en partie)
- éviter blur / glass coûteux plein écran sur TV bas de gamme
- même stratégie tampon live que tablette (LIMITATIONS §2) — zapping TV encore plus sensible au ressenti

### 4.6 Store / politique

Infiny = lecteur BYO source. La fiche store doit le dire clairement (déjà noté `GUIDE_DEPLOIEMENT.md`).  
TV ne change pas le fond juridique, mais augmente la surface de review (bannière, captures 16:9, D-pad).

---

## 5. Matrice de maturité (aujourd’hui)

| Domaine | Maturité | Blocant pour un MVP TV ? |
|---|---|---|
| Leanback manifeste + banner 320×180 | ~95 % | Non (bloquant levé) |
| `react-native-tvos` (dep) | 0 % installé ; **aligné npm** `0.86.2-0` | Oui pour UX |
| Focus / D-pad UI | 0 % (reporté post lot B) | Oui pour UX |
| Pairing backend | ~95 % | Non |
| Pairing mobile (poll + session) | ~30 % — **carte Accueil trompeuse** | Oui pour auth *et* pour honnêteté produit |
| Lecteur moteur (`PlayerController` / `VideoView`) | Réutilisable | Non |
| Lecteur chrome (overlays / gestes) | Non TV-ready | Oui (risque n°1) |
| Import catalogue | OK tablette | À revalider stick |
| EAS profils TV | 0 % | Oui pour pipeline |
| Tests émulateur / stick | 0 % | Oui pour go release |

---

## 6. Effort indicatif (après feu vert — hors cette étude)

Ordres de grandeur **après** lot B validé ; pas d’engagement calendaire ici.

| Lot | Contenu | Ordre de grandeur |
|---|---|---|
| TV-0 | Asset `tv_banner` 320×180 | **Fait** (master 1280×720 archivé à côté) |
| B-pair | Finir poll+jeton **ou** masquer `PhonePairingCard` (produit Accueil, pas TV) | Petit — **à trancher au lot B** |
| TV-1 | Bascule `react-native-tvos@0.86.2-0` + `@react-native-tvos/config-tv` + profils EAS `*_tv` + smoke phone+TV | Moyen (risque régression) |
| TV-2 | Écran code TV + poll + session (si pas déjà fait en B-pair) | Petit / moyen |
| TV-3 | **Composants focus** + chrome lecteur TV (addendum — après lot B) | Moyen / large |
| TV-4 | Campagne émulateur Android TV + stick Fire/Google | Moyen (temps machine + terrain) |

TV-3 est **explicitement hors démarrage maintenant**.

---

## 7. Plan recommandé (décision, pas d’exécution)

1. **Maintenant** : terminer validation tablette `e0fdce5` ; lot B reste bloqué ; **aucune** branche TV.
2. **Au lot B** (quand débloqué) : trancher B-pair — finir le flux Accueil **ou** retirer/masquer la carte (voir §11). Redesign phone/tablette **sans** chrome télécommande.
3. **Ensuite seulement** : chantier TV TV-1 → TV-2 → TV-3 (focus + overlays lecteur) → TV-4.
4. Critère de « Android TV supporté » produit : niveau B (focus + pairing + lecture) vert sur stick réel — pas le seul launcher Leanback.

---

## 8. Décisions à trancher plus tard (pas maintenant)

1. Un APK universel phone+TV sideload, ou deux artefacts EAS (`preview` vs `preview_tv`) ?
2. Conservatism monorepo : bascule `react-native-tvos@0.86.2-0` pour tout le workspace mobile dès TV-1 ?
3. Amazon Appstore dans le même sprint que Google TV / sideload, ou plus tard ?
4. Le plugin `withAndroidTv` survit-il à côté de `@react-native-tvos/config-tv` ?
5. Lot B : **finir** l’appairage Accueil ou **masquer** la carte ?

---

## 9. Références internes

- `apps/mobile/plugins/withAndroidTv.js`
- `apps/mobile/assets/images/tv_banner.png` (+ master `tv_banner-1280x720.png`)
- `docs/LIMITATIONS.md` §3
- `docs/ARCHITECTURE.md` §8
- `docs/GUIDE_BUILD.md` (Build Android TV)
- `docs/GUIDE_DEPLOIEMENT.md` (Appairage TV)
- Backend : `apps/backend/src/pairing/`
- Mobile : `apps/mobile/src/services/pairing/`, `PhonePairingCard.tsx`
- Lecteur : `PlayerVideoSurface.tsx`, `player/[channelId].tsx`, `PlayerGestureLayer.tsx`

## 10. Références externes

- Expo : [Build apps for TV](https://docs.expo.dev/guides/building-for-tv/)
- Expo SDK table : [versions/latest](https://docs.expo.dev/versions/latest/) (`0.86-stable` pour SDK 57)
- Fork : [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos) — npm `0.86.2-0`
- Focus `VideoView` : [expo/expo#40264](https://github.com/expo/expo/issues/40264)

---

## 11. Complément — ce que l’utilisateur obtient vraiment avec le QR / code Accueil

Constat : `PhonePairingCard` appelle `POST /pairing/start`, affiche le code et un QR vers  
`https://infinystream.pro/pair?code=XXXXXX`.  
Le mobile **ne poll jamais** et **n’écrit jamais** de jeton.

### Parcours réel (code actuel)

1. **Accueil app** : génération d’un code + `deviceSecret` (gardé seulement en mémoire JS, jamais envoyé au web).
2. **Scan QR ou saisie** sur `infinystream.pro/pair` :
   - Si non connecté → redirection login/register avec `next=/pair?code=…`.
   - Si connecté → page « Connecter un téléviseur », code prérempli, lookup `GET /pairing/:code`.
3. **Autoriser** (`POST /pairing/:code/approve`) :
   - Backend enregistre / touche un **appareil** (compte un slot de la limite).
   - Statut pairing → `approved`.
   - Web affiche : *« Téléviseur autorisé. Il va se connecter tout seul. »*
4. **Côté app qui a affiché le code** :
   - Aucun `POST /pairing/poll` → **aucun `accessToken` reçu**.
   - L’état auth de l’app **ne change pas**.
   - Au bout du compte à rebours (~10 min) : `refresh()` relance un **nouveau** `start` ; l’ancien code approuvé n’est jamais consommé par un poll.
5. **Refuser** : statut `denied` ; même silence côté app.

### Conséquences produit

- L’utilisateur croit appairer ; le web confirme un succès **faux** pour l’app (rien ne « se connecte tout seul »).
- Un slot appareil peut être **consommé** à l’approve alors que le client n’a jamais pris le JWT.
- Ce bug est **visible dès l’Accueil phone/tablette** — indépendant d’Android TV.

### Implication pour le lot B (décision, pas de code ici)

Soit :

- **A** — Finir le flux : `poll` + échange de jeton + état « appairé » / session, et aligner le copy web ;  
soit  
- **B** — Masquer / retirer la carte tant que le flux n’est pas terminé.

Ne pas laisser la promesse en évidence.

---

*Compléments 1–3 intégrés (chiffre fork, overlays, parcours Accueil). Assets banner ajoutés. Toujours aucune dépendance runtime ni fichier de build modifié dans cette passe.*
