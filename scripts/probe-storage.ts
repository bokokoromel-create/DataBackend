import "../src/loadEnv";
import { diplomeBucket } from "../src/lib/diplomeStorage";
import { readEnv } from "../src/lib/envRead";
import { supabase } from "../src/lib/supabase";

async function main() {
  const bucket = diplomeBucket();
  console.log("SUPABASE_DIPLOMES_BUCKET =>", bucket);
  console.log("SUPABASE_URL =>", readEnv("SUPABASE_URL"));

  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("listBuckets ERROR:", listErr.message);
    process.exit(1);
  }

  const names = buckets?.map((b) => b.name) ?? [];
  console.log("Buckets visibles:", names.length ? names.join(", ") : "(aucun)");
  console.log("Bucket cible existe?", names.includes(bucket));

  if (!names.includes(bucket)) {
    console.log(
      "\n=> Crée un bucket nommé exactement",
      JSON.stringify(bucket),
      "dans le MÊME projet que SUPABASE_URL.",
    );
    process.exit(1);
  }

  const path = "_healthcheck/probe.txt";
  const buf = Buffer.from(`probe ${new Date().toISOString()}`);
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
    upsert: true,
    contentType: "text/plain",
  });
  if (upErr) {
    console.error("upload ERROR:", upErr.message);
    process.exit(1);
  }
  console.log("Upload probe OK ->", path);

  const { data: listed, error: lsErr } = await supabase.storage.from(bucket).list(
    "_healthcheck",
  );
  if (lsErr) console.error("list ERROR:", lsErr.message);
  else
    console.log(
      "Fichiers listés:",
      listed?.map((f) => f.name).join(", ") ?? "(vide)",
    );

  await supabase.storage.from(bucket).remove([path]);
  console.log("Probe terminée (fichier test supprimé).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
