import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Retire BOM, CR, guillemets « collés » par .env / Docker --env-file pour éviter P1013 (schéma non reconnu). */
function normalizeDatabaseUrl(raw: string): string {
  let u = raw.trim().replace(/\r/g, "");
  if (u.charCodeAt(0) === 0xfeff) {
    u = u.slice(1).trim().replace(/\r/g, "");
  }
  while (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'"))
  ) {
    u = u.slice(1, -1).trim().replace(/\r/g, "");
  }
  return u;
}

/** Réelle en prod / local (.env) ; placeholder uniquement pour `prisma generate` en CI sans secrets. */
function datasourceUrl(): string {
  const raw =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (raw) return normalizeDatabaseUrl(raw);

  // Échec explicite en runtime/production : évite l'erreur trompeuse
  // « Can't reach database server at 127.0.0.1:5432 » lorsque les variables
  // ne sont pas injectées par la plateforme (Sevalla, Railway, Coolify, etc.).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL/DIRECT_URL manquant en production. " +
        "Configure ces variables dans les paramètres de ta plateforme de déploiement " +
        "(Sevalla/Railway/Coolify → Service → Variables) avec l'URL pooler Supabase " +
        "(port 6543 + ?pgbouncer=true pour DATABASE_URL, port 5432 ?sslmode=require pour DIRECT_URL).",
    );
  }

  // Fallback dev/CI uniquement (ex. `prisma generate` sans accès au cluster).
  return "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl(),
  },
});
