# Déploiement sur un VPS (Hostinger ou équivalent)

Ce guide part du principe que vous avez déjà un VPS (Ubuntu/Debian recommandé — c'est la distribution par défaut
chez Hostinger) et le dépôt GitHub `noealexiscamara-stack/Infinistream`. Il couvre le chemin **Docker Compose +
Nginx + Let's Encrypt**, qui est celui pour lequel `docker-compose.yml`, `apps/backend/Dockerfile` et
`deploy/nginx/infiny-stream.conf` ont été écrits et vérifiés dans ce dépôt.

**Approche retenue : le code entier vit sur GitHub, le VPS ne manipule que des images.** `apps/backend/Dockerfile`
est construit par `.github/workflows/backend-image.yml` (GitHub Actions) à chaque push sur `main` qui touche le
backend, et poussé vers GitHub Container Registry (`ghcr.io`). Le VPS ne clone le dépôt que pour récupérer les
fichiers de configuration légers (`docker-compose.yml`, `deploy/nginx/...`) — il ne lance jamais `npm ci` ni
`nest build` lui-même, seulement `docker compose pull` puis `up`. Ça évite complètement le problème rencontré en
développant ce projet (le registre Docker Hub était bloqué dans le sandbox de développement) et ça garde le VPS
propre : pas de Node.js à y maintenir, juste Docker.

Tout ce qui suit s'exécute **sur le VPS**, via SSH — ni moi (Claude) ni cette session cloud n'avons d'accès direct à
votre VPS ; copiez/collez ces commandes dans votre propre terminal SSH.

## 0. Ce qu'il vous faut avant de commencer

- L'adresse IP du VPS et un accès SSH (fourni par Hostinger à l'achat, ou dans hPanel).
- Un nom de domaine dont vous contrôlez la zone DNS (ex. `api.infinystream.app`) — nécessaire pour le HTTPS via
  Let's Encrypt. Sans domaine, vous pouvez tout faire sauf l'étape TLS.
- Le code poussé sur `github.com/noealexiscamara-stack/Infinistream` (voir la section "Pousser le code" plus bas si
  ce n'est pas encore fait).

## 1. Connexion et mise à jour du système

```bash
ssh root@VOTRE_IP_VPS
apt update && apt upgrade -y
```

## 2. Installer Docker et Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
docker compose version
```

## 3. Cloner le dépôt

Le VPS n'a besoin que des fichiers de configuration (`docker-compose.yml`, `deploy/nginx/`, les guides) — le clone
complet reste petit (pas de `node_modules`) donc autant garder tout le dépôt, mais aucune commande `npm`/`nest`
n'y sera jamais lancée :

```bash
mkdir -p /opt/infiny-stream
git clone https://github.com/noealexiscamara-stack/Infinistream.git /opt/infiny-stream
cd /opt/infiny-stream
```

## 4. Configurer les secrets de production

```bash
cp .env.production.example .env.production
openssl rand -hex 32   # copiez le résultat dans JWT_SECRET
openssl rand -hex 32   # relancez pour ENCRYPTION_KEY — deux secrets DIFFÉRENTS
nano .env.production    # collez les deux secrets + un mot de passe DB fort dans DB_PASSWORD
```

`.env.production` n'est jamais commité (il est dans `.gitignore`) — c'est normal et voulu, ces secrets ne doivent
exister que sur ce serveur.

## 5. Récupérer l'image et démarrer Postgres + le backend

**Préalable** : l'image doit exister sur GHCR avant de pouvoir la tirer. Si vous venez de pousser le code sur
GitHub pour la première fois, ouvrez l'onglet **Actions** du dépôt et attendez que le workflow "Build & push
backend image" se termine (quelques minutes) avant de continuer ici.

Par défaut, le paquet GHCR créé par un premier push est **privé** — le VPS doit s'authentifier pour le tirer, avec
un token GitHub à droits `read:packages` uniquement (créez-le sur
[github.com/settings/tokens](https://github.com/settings/tokens?type=beta), scope minimal) :

```bash
echo VOTRE_TOKEN_GITHUB | docker login ghcr.io -u noealexiscamara-stack --password-stdin
```

(Alternative : rendre le paquet public depuis l'onglet Packages du dépôt GitHub, une fois qu'il existe — évite
d'avoir à gérer un token sur le VPS, acceptable ici puisque l'image ne contient aucun secret, seulement du code
compilé.)

```bash
docker compose --env-file .env.production pull
docker compose --env-file .env.production up -d
docker compose ps        # les deux services doivent être "running"/"healthy"
docker compose logs -f backend   # Ctrl+C pour quitter les logs une fois "listening on :3000" vu
```

## 6. Appliquer la migration initiale

Le schéma de base (`apps/backend/src/migrations/*-Init.ts`) est déjà généré, compilé lors du build Docker, et commité
dans le dépôt — vous n'avez jamais besoin de lancer `migration:generate` en production, seulement `migration:run`.
Faites-le une fois, juste après le premier `docker compose up`, en réutilisant l'image déjà construite (commande
testée telle quelle dans ce dépôt) :

```bash
docker compose --env-file .env.production run --rm backend node -e "
  const { AppDataSource } = require('./dist/database/data-source.js');
  AppDataSource.initialize().then(ds => ds.runMigrations()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
"
```

Vérifiez ensuite que les tables existent :

```bash
docker compose --env-file .env.production exec postgres psql -U infiny_stream -d infiny_stream -c '\dt'
```

## 7. Vérifier que l'API répond

```bash
curl http://127.0.0.1:3000/config
```

Vous devez voir un JSON avec `basePrice`, `baseCurrency`, `trialDays`, `deviceLimit` — les valeurs de
`.env.production`, pas des valeurs codées en dur côté client (règle produit #38).

## 8. Nginx + HTTPS (Let's Encrypt)

Pointez d'abord un enregistrement DNS **A** de votre domaine (ex. `api.infinystream.app`) vers l'IP du VPS, puis :

```bash
apt install -y nginx certbot python3-certbot-nginx
cp deploy/nginx/infiny-stream.conf /etc/nginx/sites-available/infiny-stream
sed -i 's/api.VOTRE-DOMAINE.example/api.infinystream.app/' /etc/nginx/sites-available/infiny-stream   # adaptez le domaine
ln -s /etc/nginx/sites-available/infiny-stream /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d api.infinystream.app   # génère le certificat et réécrit le fichier pour ajouter le bloc HTTPS
```

Vérification finale, depuis votre propre machine cette fois (pas le VPS) :

```bash
curl https://api.infinystream.app/config
```

## 9. Créer le premier compte admin

Il n'existe pas encore d'écran ni de commande dédiée pour promouvoir un compte administrateur (voir
`docs/LIMITATIONS.md` #6) — inscrivez-vous normalement dans l'app ou via `POST /auth/register`, puis :

```bash
docker compose --env-file .env.production exec postgres psql -U infiny_stream -d infiny_stream \
  -c "UPDATE users SET is_admin = true WHERE email = 'votre@email.com';"
```

Le dashboard admin (`apps/admin/index.html`) est servi par le même Nginx sous `/admin/` (voir la config) —
accessible à `https://api.infinystream.app/admin/`, connectez-vous avec ce compte.

## 10. Mises à jour ultérieures

Un push sur `main` qui touche `apps/backend/` déclenche automatiquement le workflow GitHub Actions qui reconstruit
et pousse une nouvelle image `:latest` — le VPS n'a plus qu'à la retirer :

```bash
cd /opt/infiny-stream
git pull   # récupère d'éventuels changements de docker-compose.yml / nginx / migrations
docker compose --env-file .env.production pull
docker compose --env-file .env.production up -d
# si une nouvelle migration a été ajoutée dans src/migrations/, répétez la commande de l'étape 6
```

Pour un déploiement reproductible plutôt que de toujours suivre `:latest` (utile une fois en production réelle,
pour pouvoir revenir en arrière précisément) : fixez `IMAGE_TAG=<sha du commit>` dans `.env.production` — chaque
build CI pousse aussi un tag nommé par le SHA du commit, visible dans l'onglet Actions ou Packages du dépôt.

## Dimensionnement

NestJS + Postgres tournent confortablement sur les plus petites offres VPS actuelles (1 vCPU / 1 Go de RAM suffit
pour démarrer ; 2 Go recommandés si le dashboard admin ou des pics de trafic sont attendus). Si votre VPS Hostinger
dispose de moins de 1 Go de RAM, ajoutez un fichier swap avant l'étape 5 :

```bash
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## Pousser le code sur GitHub

Cette session cloud n'a pas d'accès en écriture à `github.com/noealexiscamara-stack/Infinistream` (pas
d'identifiants configurés ici, et ce serait risqué de vous en demander un dans cette conversation). Le dépôt local a
été initialisé avec un premier commit dans cette session — pour le pousser vous-même :

```bash
# depuis votre machine, après avoir récupéré l'archive du projet fournie dans le chat
cd infiny-stream
git remote add origin https://github.com/noealexiscamara-stack/Infinistream.git
git push -u origin main
```

(Si le dépôt GitHub contient déjà un commit initial — ex. un README créé depuis l'interface GitHub — utilisez
`git pull --rebase origin main` avant le push, ou `git push -u origin main --force` uniquement si le dépôt est vide
de tout code utile.)
