# Zavestro Admin Dashboard — Deployment

Internal admin SPA (Vite/React). Static build served by nginx-in-a-container,
behind the droplet's shared nginx. Reuses the **same droplets** as backend/web.

| Env | Branch | URL | Container port |
|-----|--------|-----|----------------|
| local | — | `npm run dev` on your PC | 5173 |
| staging | `develop` | `admin-staging.zavestro.in` | 3002 |
| production | `main` | `admin.zavestro.in` | 3002 |

Container `zavestro-admin` (:3002) sits alongside `zavestro-web` (:3000) and
`zavestro-api` (:8080). State dir on the droplet: `/opt/zavestro-admin/`.

## Pipelines
- **CI** (`.github/workflows/ci.yml`) — PR + push to develop: lint (advisory) → `tsc -b && vite build`.
- **Deploy** (`.github/workflows/deploy.yml`) — `develop→staging`, `main→production`. Builds an env-baked image (VITE_* inline into the bundle), pushes to GHCR, SSH-deploys, health-checks `:3002`. **Dormant** until repo variable `ADMIN_DEPLOY_ENABLED=true`.

## One-time setup to activate
### 1. Outer nginx on each droplet
```bash
sudo cp nginx/zavestro-admin.conf /etc/nginx/conf.d/zavestro-admin.conf
#   PROD:    server_name admin.zavestro.in        (as shipped)
#   STAGING: server_name admin-staging.zavestro.in + matching cert
sudo certbot --nginx -d admin.zavestro.in        # (staging: admin-staging.zavestro.in)
sudo nginx -t && sudo systemctl reload nginx
```

### 2. GitHub Secrets (same droplet values as backend)
`SSH_PRIVATE_KEY`, `STAGING_SSH_HOST/USER`, `PRODUCTION_SSH_HOST/USER`.

### 3. GitHub Variables, per Environment (staging / production)
```
VITE_API_URL   staging: https://api-staging.zavestro.in   prod: https://api.zavestro.in
VITE_ENV       staging | production
# optional (client-public): VITE_SENTRY_DSN, VITE_DD_APPLICATION_ID,
#   VITE_DD_CLIENT_TOKEN, VITE_DD_SITE, VITE_CONFIGCAT_SDK_KEY
```
> Build-baked → changing a value needs a redeploy, not just a restart.

### 4. Flip it on
```bash
gh variable set ADMIN_DEPLOY_ENABLED --repo AniDeep-Labs/zavestro-admin-dashboard --body true
```

## Note
`.env` is currently committed with (client-public) Sentry/Datadog/ConfigCat
tokens + `VITE_ENV=development`. It's `.dockerignore`d so deploys use the
GitHub variables above, not this file. Recommend gitignoring `.env` and keeping
only `.env.example` tracked.

## Rollback
Images are tagged `ghcr.io/anideep-labs/zavestro-admin-dashboard:sha-<commit>`:
```bash
cd /opt/zavestro-admin
IMAGE=ghcr.io/anideep-labs/zavestro-admin-dashboard:sha-<oldsha> docker compose -f docker-compose.production.yml up -d --force-recreate admin
```
