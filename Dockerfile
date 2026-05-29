# Data Horizon API — image production (Railway / Docker)
# Version alignée sur package.json (1.0.1)

ARG API_VERSION=1.0.1

# ── Build ─────────────────────────────────────
FROM node:22-alpine AS builder

ARG API_VERSION
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# Retire les devDependencies avant la copie vers l’image finale
RUN npm prune --omit=dev

# ── Production ────────────────────────────────
FROM node:22-alpine AS runner

ARG API_VERSION
LABEL org.opencontainers.image.title="Data Horizon API"
LABEL org.opencontainers.image.version="${API_VERSION}"
LABEL org.opencontainers.image.description="Backend Express + Prisma + Supabase"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV API_VERSION=${API_VERSION}

RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --from=builder --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=app:app /app/package*.json ./

USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))"

# Migrations puis serveur — échec migration = conteneur arrêté (set -e)
CMD ["sh", "-ec", "npx prisma migrate deploy && node dist/index.js"]
