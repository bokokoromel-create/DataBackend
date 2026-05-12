/**
 * Client Supabase **service role** — exclusivement le backend (jamais dans le navigateur).
 *
 * Utilisé pour : création / MAJ Auth des users (inscription, admin), lecture du JWT participant
 * via `auth.getUser(accessToken)` (= validation du même access token que `signInWithPassword` côté front).
 *
 * Le front continue d’appeler **Supabase avec la clé anon** directement ; les URLs projet n’ont pas
 * à passer par cette API Node. Voir variables `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
 */
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./envRead";

function assertValidSupabaseHttpUrl(url: string, envName: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `${envName} n’est pas une URL HTTP(S) valide après trim/normalisation — vérifie le .env ou les variables du conteneur (Railway, Docker --env-file, etc.). Exemple attendu : https://<ref>.supabase.co`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `${envName} doit utiliser le schéma http ou https (reçu : « ${parsed.protocol} »). Une URL Postgres (postgresql://…) ne convient pas ici.`,
    );
  }
}

const url = readEnv("SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!url) {
  throw new Error(
    "SUPABASE_URL est absent ou vide après trim/normalisation — définis-le dans les variables d’environnement du serveur (fichier .env, Railway → Variables, ou Docker --env-file).",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY est absent ou vide après trim/normalisation — clé secret service role depuis le tableau Supabase (Project Settings → API).",
  );
}

assertValidSupabaseHttpUrl(url, "SUPABASE_URL");

export const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
