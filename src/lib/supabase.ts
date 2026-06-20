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

const urlRaw = readEnv("SUPABASE_URL");
const serviceRoleKeyRaw = readEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!urlRaw) {
  throw new Error(
    "SUPABASE_URL est absent ou vide après trim/normalisation — définis-le dans les variables d’environnement du serveur (fichier .env, Railway → Variables, ou Docker --env-file).",
  );
}

if (!serviceRoleKeyRaw) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY est absent ou vide après trim/normalisation — clé secret service role depuis le tableau Supabase (Project Settings → API).",
  );
}

assertValidSupabaseHttpUrl(urlRaw, "SUPABASE_URL");

const url: string = urlRaw;
const serviceRoleKey: string = serviceRoleKeyRaw;

/**
 * Singleton service-role : utilisé pour Storage, validation JWT (`auth.getUser(token)`)
 * et opérations admin (`auth.admin.*`). On ne doit JAMAIS appeler `signInWithPassword`
 * (ni `setSession`) dessus, sinon supabase-js mémorise la session du dernier user et
 * envoie son JWT en `Authorization` sur les requêtes suivantes — ce qui désactive le
 * bypass RLS et fait échouer l’upload Storage avec « row-level security policy ».
 */
export const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Connecte un utilisateur (participant ou admin) sans toucher au singleton service_role.
 *
 * Crée un client jetable juste pour récupérer la `session` (access_token / refresh_token).
 * À utiliser dans les routes `/login` au lieu de `supabase.auth.signInWithPassword(...)`.
 */
export async function signInUserWithPassword(
  email: string,
  password: string,
) {
  const oneOff = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return oneOff.auth.signInWithPassword({ email, password });
}
