/**
 * Client Supabase **service role** — exclusivement le backend (jamais dans le navigateur).
 *
 * Utilisé pour : création / MAJ Auth des users (inscription, admin), lecture du JWT participant
 * via `auth.getUser(accessToken)` (= validation du même access token que `signInWithPassword` côté front).
 *
 * Le front continue d’appeler **Supabase avec la clé anon** directement ; les URLs projet n’ont pas
 * à passer par cette API Node. Voir variables `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans les variables d'environnement du serveur (Railway: Service → Variables).",
  );
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
