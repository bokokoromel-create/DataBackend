import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Réelle en prod / local (.env) ; placeholder uniquement pour `prisma generate` en CI sans secrets. */
function datasourceUrl(): string {
  const url =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (url) return url;
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
