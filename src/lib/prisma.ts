import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readEnv } from "./envRead";

function createPrismaClient(): PrismaClient {
  const url = readEnv("DATABASE_URL") || readEnv("DIRECT_URL");

  if (!url) {
    throw new Error(
      "DATABASE_URL ou DIRECT_URL doit être défini et non vide après trim/normalisation. " +
        "Supabase : URL pooler (6543 + ?pgbouncer=true) en DATABASE_URL recommandée ; " +
        "DIRECT_URL (5432) sinon. Railway : Service → Variables.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg(url),
  });
}

// Singleton partagé entre les hot-reloads `ts-node` (dev) — évite la fuite de connexions.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
