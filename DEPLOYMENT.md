# Déploiement — Dokploy (VPS Contabo)

Le déploiement se fait via **Dokploy** (type *Docker Compose*). Dokploy fournit
**Traefik + HTTPS (Let's Encrypt)** automatiquement : rien de tout cela n'est dans
le compose. On lui donne `docker-compose.prod.yml`, les secrets, et un domaine.

```
┌─────────────────────────────────────────────────────────────┐
│  VPS Contabo                                                  │
│                                                              │
│  Internet ─► Traefik (Dokploy, :443 HTTPS)                   │
│                 │  route le domaine vers le service frontend  │
│                 ▼  (réseau dokploy-network)                   │
│             frontend (nginx)                                  │
│               ├─ sert le build React                          │
│               └─ proxy /api ─► backend:3001                   │
│                                   │                           │
│                                   ▼                           │
│                               postgres:5432                   │
│             adminer (interne, sans domaine)                   │
└─────────────────────────────────────────────────────────────┘
```

Postgres et Adminer ne sont **pas** exposés. Le frontend n'a **aucun port publié** :
c'est Traefik qui l'atteint via `dokploy-network`.

---

## 1. Pré-requis

- Un VPS avec **Dokploy** installé (`curl -sSL https://dokploy.com/install.sh | sh`).
- Le code poussé sur un dépôt Git (GitHub/GitLab) accessible par Dokploy.

## 2. Créer le projet dans Dokploy

1. **Create Application** → type **Compose**.
2. **Provider** : connecter le dépôt Git + la branche.
3. **Compose Path** : `docker-compose.prod.yml`.

## 3. Renseigner les secrets

Onglet **Environment** → coller le contenu de [`.env.example`](.env.example) et
remplir les valeurs :

| Variable            | Valeur                                              |
|---------------------|-----------------------------------------------------|
| `POSTGRES_PASSWORD` | mot de passe fort                                   |
| `JWT_SECRET`        | `openssl rand -hex 32`                              |
| `ADMIN_PASSWORD`    | mot de passe admin (login `admin` par défaut)       |
| `ADMIN_EMAIL`       | ton email                                           |

`POSTGRES_DB`, `POSTGRES_USER`, `ADMIN_USERNAME`, `JWT_EXPIRES_IN` ont des
valeurs par défaut — ne les surcharger que si nécessaire.

## 4. Déclarer le domaine

Onglet **Domains** → **Add Domain** :

| Champ    | Valeur                       |
|----------|------------------------------|
| Host     | `quiz.ton-domaine.com`       |
| Service  | `frontend`                   |
| Port     | `80`                         |
| HTTPS    | activé (Let's Encrypt)       |

> Prérequis DNS : un enregistrement **A** `quiz.ton-domaine.com` → IP du VPS.

## 5. Déployer

Bouton **Deploy**. Au **premier** démarrage, le backend crée automatiquement le
compte admin et importe les 6 examens (base vide). Aux déploiements suivants,
aucune donnée n'est écrasée (le volume `pmp_quiz_postgres_data` persiste).

Vérifier dans les **logs** du service `backend` :

```
✅  Admin auto-créé  →  admin
✅  6 examens importés automatiquement (base vide)
🚀  PMP Quiz API  →  http://localhost:3001
```

→ App en ligne sur `https://quiz.ton-domaine.com` · login `admin` / `ADMIN_PASSWORD`.

---

## Opérations courantes

Via le **terminal** du conteneur (UI Dokploy) ou `docker compose exec` sur le VPS :

```bash
# Réinitialiser COMPLÈTEMENT le contenu des quiz (destructif, garde les users)
npm run seed                       # depuis le conteneur backend

# Sauvegarde de la base (depuis le conteneur postgres)
pg_dump -U pmp_user pmp_quiz > /tmp/backup.sql

# Accéder à Adminer (interne) depuis ta machine via tunnel SSH :
#   ssh -L 8090:<nom_conteneur_adminer>:8080 user@vps   (ou via le terminal Dokploy)
```

Mise à jour : `git push` → **Deploy** (ou auto-deploy sur push si activé dans Dokploy).

---

## Développement local

En local, seuls postgres + adminer tournent en conteneur ; backend et frontend
se lancent en natif (hot-reload) :

```bash
docker compose up -d                          # postgres (5544) + adminer (8090)
cd backend  && npm install && npm run dev     # API :3001 (auto-bootstrap admin/examens)
cd frontend && npm install && npm start       # React :3000 (proxy → :3001)
```

Admin local : `admin` / `Admin2024!` (ou `ADMIN_PASSWORD` de `backend/.env`).
Adminer local : http://localhost:8090 — serveur `postgres`, user `pmp_user`.
