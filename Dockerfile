# Data Horizon API — image production (Railway / Sevalla / Docker Hub).
# Multi-stage : compile TypeScript en stage 1, embarque uniquement le
# runtime + node_modules prod en stage 2.
#
# Build :
#   docker build --build-arg API_VERSION=$(node -p "require('./package.json').version") -t datahorizon-api:1.2.0 .
# Run :
#   docker run --env-file .env -p 4000:4000 datahorizon-api:1.2.0

ARG NODE_IMAGE=node:22-alpine
ARG API_VERSION=1.2.0

############################################
# Stage 1 — install deps + compile TS
############################################
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# 1. Manifests en premier pour profiter du cache de couches Docker
#    quand seules les sources changent.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# `postinstall` (package.json) déclenche déjà `prisma generate`,
# pas besoin d'une étape supplémentaire.
RUN npm ci

# 2. Sources + build TypeScript → /app/dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 3. Réduit node_modules aux dépendances de production uniquement.
RUN npm prune --omit=dev


############################################
# Stage 2 — image runtime minimale
############################################
FROM ${NODE_IMAGE} AS runner

ARG API_VERSION

LABEL org.opencontainers.image.title="Data Horizon API" \
      org.opencontainers.image.version="${API_VERSION}" \
      org.opencontainers.image.description="Backend Express + Prisma + Supabase Auth/Storage" \
      org.opencontainers.image.licenses="ISC"

ENV NODE_ENV=production \
    PORT=4000 \
    API_VERSION=${API_VERSION} \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# `tini` = init léger qui propage SIGTERM/SIGINT au process Node :
# indispensable pour un shutdown propre lors d'un redeploy Railway/K8s
# (sinon Node tourne en PID 1 et ignore SIGTERM, le conteneur est tué
# au bout du grace period).
RUN apk add --no-cache tini

WORKDIR /app

# Utilisateur non-root dédié.
RUN addgroup -g 1001 -S app \
 && adduser  -S -u 1001 -G app app

COPY --from=builder --chown=app:app /app/dist               ./dist
COPY --from=builder --chown=app:app /app/node_modules       ./node_modules
COPY --from=builder --chown=app:app /app/prisma             ./prisma
COPY --from=builder --chown=app:app /app/prisma.config.ts   ./prisma.config.ts
COPY --from=builder --chown=app:app /app/package.json /app/package-lock.json ./

USER app

EXPOSE 4000

# Healthcheck : sonde l'endpoint /health (status === "ok").
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]

# Applique les migrations Prisma puis lance le serveur compilé.
# `exec` remplace le shell pour que Node reçoive directement les signaux.
# `set -e` (via -ec) arrête le conteneur si la migration échoue.
CMD ["sh", "-ec", "npx prisma migrate deploy && exec node dist/index.js"]
