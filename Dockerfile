# ============================================================================
# Zavestro Admin Dashboard — Vite/React SPA → static nginx image
# AniDeep Labs | Made-to-Order Clothing Brand
#
# This is a STATIC SPA: `vite build` emits dist/, served by nginx. All config
# is VITE_* and BAKED at build time (Vite inlines import.meta.env.VITE_* into
# the bundle), so the build stage must receive the target env's values as
# build-args → the image is environment-specific (staging image ≠ prod image).
# ============================================================================

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Baked-at-build env (Vite gives existing process.env VITE_* the highest
# priority, overriding any .env file — which is .dockerignored anyway).
ARG VITE_API_URL
ARG VITE_ENV
ARG VITE_SENTRY_DSN
ARG VITE_DD_APPLICATION_ID
ARG VITE_DD_CLIENT_TOKEN
ARG VITE_DD_SITE
ARG VITE_CONFIGCAT_SDK_KEY
ARG VITE_COMMIT_SHA=unknown

ENV VITE_API_URL=$VITE_API_URL \
    VITE_ENV=$VITE_ENV \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_DD_APPLICATION_ID=$VITE_DD_APPLICATION_ID \
    VITE_DD_CLIENT_TOKEN=$VITE_DD_CLIENT_TOKEN \
    VITE_DD_SITE=$VITE_DD_SITE \
    VITE_CONFIGCAT_SDK_KEY=$VITE_CONFIGCAT_SDK_KEY \
    VITE_COMMIT_SHA=$VITE_COMMIT_SHA

RUN npm run build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner
RUN apk add --no-cache curl
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
