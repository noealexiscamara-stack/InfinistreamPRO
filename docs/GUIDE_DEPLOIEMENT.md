# Guide de déploiement

## Répartition du travail

Backend/infra (ce dépôt côté `apps/backend`, VPS, déploiement) : Claude. Frontend (`apps/mobile`) : Cursor. Éviter
de dupliquer ou modifier `apps/mobile` depuis une session Claude sans coordination avec ce qui a été fait côté
Cursor — se concentrer sur le backend, l'infra et la documentation qui les concerne.

Le câblage auth/abonnement mobile ↔ backend a été fait côté Cursor (commit `84454e1`) : écrans login/register,
JWT en `expo-secure-store`, `GET /subscriptions/me` remplace l'ancien suivi local, `GET /config` au bootstrap,
logout automatique sur 401. Voir la fiche du projet Claude pour le détail.

## Backend

### Base de données

En production, **désactivez `DB_SYNCHRONIZE`** (il ne doit servir qu'en développement — il peut faire perdre des
données sur un schéma déjà peuplé) et utilisez des migrations TypeORM. `apps/backend/src/database/data-source.ts`
(DataSource dédié au CLI, entités tenues synchronisées avec `app.module.ts`) et une première migration
(`apps/backend/src/migrations/*-Init.ts`, générée et testée — `migration:run` puis `migration:revert` vérifiés
contre un vrai PostgreSQL) sont déjà présents dans ce dépôt :

```bash
cd apps/backend
npm run migration:run      # applique les migrations en attente
npm run migration:revert   # annule la dernière migration (urgence uniquement)
npm run migration:generate -- ./src/migrations/NomDuChangement   # seulement lors d'un futur changement de schéma
```

`migration:generate` ne doit **jamais** être lancé contre la base de production — générez-le en dev/staging,
relisez le SQL produit, committez-le, puis lancez seulement `migration:run` en production (voir
`docs/GUIDE_VPS.md` étape 6 pour la commande exacte utilisée dans le conteneur Docker).

### Variables d'environnement obligatoires en production

| Variable | Pourquoi |
|---|---|
| `JWT_SECRET` | Signature des tokens d'authentification — une valeur par défaut faible ne doit **jamais** être déployée. |
| `ENCRYPTION_KEY` | Chiffrement at-rest des mots de passe Xtream synchronisés. |
| `DB_*` | Connexion PostgreSQL de production (utilisateur dédié, pas le superuser). |
| `ORANGE_MONEY_*`, `MTN_MOMO_*`, `HOLOPAY_*` | Nécessaires avant d'activer les paiements réels (voir LIMITATIONS.md — non implémentés dans cette passe). |

### Hébergement

Le backend est un service NestJS standard (`node dist/main.js` après `npm run build`) — déployable sur n'importe
quel hébergeur Node (Render, Railway, Fly.io, un VPS avec PM2 ou Docker).

**Chemin VPS + Docker (celui documenté et vérifié dans ce dépôt)** : le code source complet vit sur GitHub ; le VPS,
lui, ne manipule que des images pré-construites — `.github/workflows/backend-image.yml` construit
`apps/backend/Dockerfile` (build multi-stage, n'installe que la dépendance de workspace de `apps/backend`, testé
avec `npm ci --workspace=apps/backend` et `nest build` dans ce sandbox) et le pousse vers GitHub Container Registry
à chaque push sur `main`. Le VPS exécute seulement `docker compose pull && up` (via `docker-compose.yml` à la
racine, backend + PostgreSQL) — jamais de build ni de toolchain Node sur le serveur de production. Voir
**`docs/GUIDE_VPS.md`** pour le pas-à-pas complet (installation Docker, authentification GHCR, secrets, migrations,
Nginx, TLS) — écrit spécifiquement pour un déploiement sur un VPS type Hostinger.

### HTTPS et sécurité réseau

Placez le service derrière un reverse proxy TLS (nginx, Caddy, ou le TLS géré de votre hébergeur) — l'app elle-même
sert du HTTP simple. `deploy/nginx/infiny-stream.conf` fournit une config Nginx prête à l'emploi avec rate limiting
(`limit_req`, 10 req/s par IP) devant l'API, conformément à la règle produit #51 — voir `docs/GUIDE_VPS.md` étape 8
pour l'activation du TLS via Let's Encrypt/Certbot.

## Application mobile

### Publication sur le Play Store

1. `eas build --profile production --platform android` (voir GUIDE_BUILD.md) génère un `.aab`.
2. Créez une fiche d'application sur la [Play Console](https://play.google.com/console).
3. `eas submit --platform android` peut automatiser l'upload une fois `eas.json` configuré avec vos identifiants
   de service Google Play.

### Points d'attention avant publication

- Icônes/splash actuels sont ceux du template Expo par défaut (`assets/images/`) — à remplacer par l'identité
  visuelle finale d'Infiny Stream avant toute soumission.
- Le drawable `tv_banner` 320×180 est fourni sous `apps/mobile/assets/images/tv_banner.png` (voir étude TV).
- Vérifiez la politique du Play Store concernant les applications IPTV "lecteur" (BYO source) — Infiny Stream ne
  redistribue aucun contenu, mais la fiche store doit le préciser clairement pour éviter un rejet.

### Configuration pointant vers le bon backend

L'URL du backend n'est pas encore externalisée dans une variable d'environnement Expo (`app.json > extra`) dans
cette passe — le mobile n'appelle pas encore le backend du tout (voir LIMITATIONS.md #8). Avant de câbler l'auth
mobile↔backend, ajoutez `EXPO_PUBLIC_API_URL` (ou équivalent) plutôt que de coder l'URL en dur, pour pouvoir pointer
vers un environnement de staging puis de production sans changer le code.

## Dashboard admin

Fichier statique unique (`apps/admin/index.html`) — déployable sur n'importe quel hébergeur statique (Netlify,
Vercel, GitHub Pages, ou simplement servi par le même reverse proxy que le backend sur un sous-chemin `/admin`).
Aucune variable d'environnement : l'URL du backend se saisit dans l'écran de connexion et reste en mémoire pour la
session du navigateur.

## Appairage TV (Device Authorization Grant)

Le module `apps/backend/src/pairing/` implémente l'appairage d'un téléviseur sur le modèle de l'OAuth 2.0 Device
Authorization Grant (RFC 8628) — le même que Netflix ou YouTube sur TV. Il existe parce que saisir une URL M3U de
120 caractères à la télécommande est impraticable : la TV affiche un code court, l'utilisateur l'autorise depuis son
téléphone, la TV récupère un token.

| Endpoint | Auth | Appelé par |
|---|---|---|
| `POST /pairing/start` | aucune | le téléviseur |
| `POST /pairing/poll` | secret d'appareil | le téléviseur |
| `GET /pairing/:code` | JWT | le web |
| `POST /pairing/:code/approve` | JWT | le web |
| `POST /pairing/:code/deny` | JWT | le web |

**Le point de sécurité à ne pas casser** : `/start` renvoie DEUX valeurs. Le `code` court est affiché à l'écran,
donc à considérer comme devinable. Le `deviceSecret` (256 bits) n'est jamais affiché nulle part et n'est connu que
du téléviseur — c'est lui, et lui seul, qui autorise `/poll` à délivrer le token. Deviner un code affiché ne donne
donc rien. Vérifié en conditions réelles : une requête `/poll` avec le bon code mais un mauvais secret renvoie 401.

Autres garanties, toutes couvertes par `src/pairing/__tests__/` : usage strictement unique (rejeu → 410), expiration
à 10 minutes, verrouillage après 10 secrets erronés, alphabet sans caractères ambigus (ni O/0 ni I/1/L), saisie
tolérante à la casse/aux tirets, et vérification de la limite d'appareils au moment de l'autorisation plutôt que
plus tard sur la TV.

La migration correspondante est `src/migrations/*-AddPairingCodes.ts` (générée, `run` et `revert` vérifiés contre un
vrai PostgreSQL). En production, appliquer avec la commande de l'étape 6 de `docs/GUIDE_VPS.md`.

## API d'administration

`GET /admin/*`, protégé par `AdminGuard` (JWT + `is_admin` en base — vérifié : 403 pour un compte
non-admin, 401 sans token, sur les cinq routes).

| Route | Contenu |
|---|---|
| `/admin/dashboard?period=7d\|30d\|90d\|1y` | KPI, chacun avec la même valeur sur la période précédente |
| `/admin/series?period=...` | Séries temporelles utilisateurs (total cumulé, nouveaux, premium) et revenus |
| `/admin/activity?limit=` | Flux d'activité inter-tables |
| `/admin/payments?limit=` | Derniers paiements, tous utilisateurs |
| `/admin/devices?limit=` | Appareils actifs, du plus récemment utilisé |

**Trois règles d'honnêteté, à ne pas « simplifier » côté interface** (voir `admin-period.ts`) :

- `changePct` est **null** quand la période précédente vaut 0. Passer de 0 à 5 n'est ni « +500 % »
  ni « +100 % » — il n'y a pas de pourcentage à afficher. L'UI doit rendre un tiret, pas un chiffre
  inventé. C'est le cas courant sur un produit jeune, pas un cas limite exotique.
- Les séries sont **remplies de zéros sur chaque intervalle** de la plage, pour qu'un graphique ne
  puisse pas suggérer une tendance en reliant deux points de part et d'autre d'un trou.
- La courbe « utilisateurs totaux » est **cumulative** et démarre au nombre d'utilisateurs existant
  avant l'ouverture de la fenêtre. Tracer les inscriptions quotidiennes à la place ferait croire que
  le produit repart de zéro à chaque changement de période.

**Bug réel corrigé ici** : le taux de conversion divisait les abonnements premium *actifs* par les
essais *expirés*, deux populations qui ne se recouvrent pas — un utilisateur peut passer premium sans
que son essai expire. Sur le premier jeu de données réaliste, ça a produit **200 %**. Il est
maintenant mesuré par utilisateur, le numérateur étant un sous-ensemble strict du dénominateur, donc
borné à 100 % par construction ; et **null** quand aucun essai n'est encore terminé, plutôt que 0 %
qui se lirait comme un échec plutôt que comme une absence de donnée.

Aucune adresse IP n'est exposée dans `/admin/devices` : l'entité `Device` n'en stocke pas, et en
ajouter une reviendrait à conserver une donnée personnelle au sens du RGPD pour un panneau qui se lit
très bien sans. Si c'est ajouté un jour, il faudra une durée de conservation explicite.
