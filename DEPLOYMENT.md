# Zavestro Admin Dashboard — CI & Deploy

Internal admin SPA (Vite/React). **Hosted on Cloudflare Pages** — live at
**admin.zavestro.in** (CNAME → `zavestro-admin-dashboard.pages.dev`). It does
NOT run on the droplet (the earlier Docker setup was removed).

## CI
`.github/workflows/ci.yml` — on every PR + push to develop: `lint` (advisory)
+ `tsc -b && vite build`. No secrets. This is a quality gate only.

## Deploy (Cloudflare Pages)
Deployment is handled by **Cloudflare Pages**, not GitHub Actions. Configure it
in the Cloudflare dashboard → Workers & Pages → `zavestro-admin-dashboard`.

**Please verify these in the Pages project settings (I can't see them):**
1. **Git integration** — is the Pages project connected to this GitHub repo so
   it auto-builds on push? If yes, which **production branch** (e.g. `main` or
   `develop`)? That determines what "deploying admin" means.
2. **Build settings** — Build command `npm run build`, Build output dir `dist`.
3. **Environment variables** (Pages → Settings → Variables — NOT GitHub):
   ```
   VITE_API_URL   = https://api.zavestro.in     (prod)   /  https://staging-api.zavestro.in (preview)
   VITE_ENV       = production / staging
   # optional (client-public): VITE_SENTRY_DSN, VITE_DD_APPLICATION_ID,
   #   VITE_DD_CLIENT_TOKEN, VITE_DD_SITE, VITE_CONFIGCAT_SDK_KEY
   ```
   > Vite bakes these at build time — changing one needs a redeploy.

## Notes
- The Docker files (Dockerfile, compose, nginx, deploy.yml) were removed — admin
  isn't served from the droplet.
- The repo still has some unused GitHub secrets/variables/environments from the
  earlier Docker attempt; harmless, can be deleted.
- `.env` is committed with (client-public) tokens + `VITE_ENV=development`;
  recommend gitignoring it and keeping only `.env.example`.
