import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.DIRECT_URL?.trim();

  if (!url) {
    throw new Error(
      "DATABASE_URL ou DIRECT_URL doit être défini dans les variables d'environnement du serveur (pas seulement un fichier .env absent au runtime). Pour Supabase : URL « pooling » en DATABASE_URL recommandée ; sinon DIRECT_URL (session/direct) peut suffire.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg(url),
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
