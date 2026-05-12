# ── Build stage ──────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copie les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Installe toutes les dépendances
RUN npm ci

# Génère le client Prisma (nécessite prisma.config.ts pour l’URL datasource)
RUN npx prisma generate

# Copie le reste du code
COPY . .

# Compile TypeScript → JavaScript
RUN npm run build

# ── Production stage ─────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copie uniquement ce qui est nécessaire
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package*.json ./

EXPOSE 4000

# Lance les migrations puis démarre le serveur.
# `set -e` garantit qu'un échec de migration interrompt le démarrage
# (au lieu de lancer le serveur avec une DB inaccessible).
CMD ["sh", "-ec", "npx prisma migrate deploy && node dist/index.js"]