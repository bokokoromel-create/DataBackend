/**
 * Vérifie les policies RLS du bucket `diplomes` côté Supabase :
 * - Crée un user temporaire (Auth)
 * - Se connecte avec la clé anon (comme le navigateur)
 * - Tente un upload dans son dossier {auth.uid()}/probe.txt
 * - Tente un upload interdit dans un autre dossier
 * - Nettoie tout
 *
 * Sortie « ✔ » : policies OK, le front peut uploader directement.
 * Sortie « ✖ » : applique prisma/supabase/diplomes-rls.sql dans Supabase SQL Editor.
 *
 * Pré-requis : SUPABASE_ANON_KEY dans .env (Project Settings → API → anon public).
 */
import "../src/loadEnv";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "../src/lib/envRead";
import { supabase as admin } from "../src/lib/supabase";
import { diplomeBucket } from "../src/lib/diplomeStorage";

async function main() {
  const url = readEnv("SUPABASE_URL");
  const anon = readEnv("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    console.error(
      "✖ SUPABASE_ANON_KEY manquante. Ajoute-la dans .env (Settings → API → anon public).",
    );
    process.exit(1);
  }

  const bucket = diplomeBucket();
  const email = `probe-rls-${Date.now()}@example.com`;
  const password = "ProbeRls!Pass123";

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) {
    console.error("✖ createUser:", cErr?.message);
    process.exit(1);
  }
  const supabaseId = created.user.id;
  const ownPath = `${supabaseId}/probe.txt`;
  const otherPath = `intrus-${Date.now()}/probe.txt`;
  let ok = true;

  try {
    const client = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signErr } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      console.error("✖ signIn:", signErr.message);
      process.exit(1);
    }

    process.stdout.write(`Upload propre dossier (${ownPath}) … `);
    const { error: upOwn } = await client.storage
      .from(bucket)
      .upload(ownPath, new Blob(["probe"]), { upsert: true });
    if (upOwn) {
      ok = false;
      console.log("✖", upOwn.message);
    } else {
      console.log("✔ autorisé");
    }

    process.stdout.write(`Upload dossier d’autrui (refus attendu) … `);
    const { error: upOther } = await client.storage
      .from(bucket)
      .upload(otherPath, new Blob(["intrus"]), { upsert: true });
    if (!upOther) {
      ok = false;
      console.log("✖ AUTORISÉ (policies trop permissives)");
      await admin.storage.from(bucket).remove([otherPath]);
    } else {
      console.log("✔ refusé :", upOther.message);
    }
  } finally {
    await admin.storage.from(bucket).remove([ownPath]).catch(() => {});
    await admin.auth.admin.deleteUser(supabaseId).catch(() => {});
  }

  if (ok) {
    console.log("\n✔ RLS OK : le front peut uploader dans son propre dossier.");
  } else {
    console.error(
      "\n✖ RLS KO. Ouvre Supabase → SQL Editor et exécute :\n  prisma/supabase/diplomes-rls.sql",
    );
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
