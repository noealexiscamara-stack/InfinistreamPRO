# Guide de déploiement

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

**Chemin VPS + Docker (celui documenté et vérifié dans ce dépôt)** : `apps/backend/Dockerfile` (build multi-stage,
n'installe que la dépendance de workspace de `apps/backend`, testé avec `npm ci --workspace=apps/backend` et
`nest build` dans ce sandbox) + `docker-compose.yml` à la racine (backend + PostgreSQL). Voir
**`docs/GUIDE_VPS.md`** pour le pas-à-pas complet (installation Docker, secrets, migrations, Nginx, TLS) — écrit
spécifiquement pour un déploiement sur un VPS type Hostinger.

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
- Le drawable `tv_banner` (voir LIMITATIONS.md #3) doit exister avant un build incluant le support Android TV.
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
