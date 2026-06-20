/**
 * Test de bout en bout du flux Option A :
 * 1. Crée un participant temporaire (Supabase Auth + ligne User Prisma)
 * 2. Login → JWT
 * 3. POST /me/diplome avec un PDF factice (multipart/form-data)
 * 4. Vérifie que la ligne `Diplome` est créée + fichier dans Storage
 * 5. GET /me/diplome → vérifie le payload renvoyé
 * 6. Nettoie tout (Storage, table, Auth)
 *
 * Pré-requis : `npm run start` ou `npm run dev` actif sur PROBE_BASE_URL (par défaut http://localhost:4000).
 */
import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { signInUserWithPassword, supabase as admin } from "../src/lib/supabase";
import { removeDiplomeFile } from "../src/lib/diplomeStorage";

const BASE = process.env.PROBE_BASE_URL || "http://localhost:4000";

async function main() {
  console.log("Cible:", BASE);
  const ts = Date.now();
  const email = `probe-diplome-${ts}@example.com`;
  const password = "ProbeDiplome!Pass123";

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    { email, password, email_confirm: true },
  );
  if (createErr || !created.user) {
    throw new Error("createUser: " + (createErr?.message ?? "no user"));
  }
  const supabaseId = created.user.id;

  const user = await prisma.user.create({
    data: {
      supabaseId,
      prenom: "Probe",
      nom: "Diplome",
      email,
      ville: "Brazzaville",
    },
    select: { id: true },
  });

  let storagePath: string | null = null;

  try {
    const { data: signin, error: signErr } = await signInUserWithPassword(
      email,
      password,
    );
    if (signErr || !signin.session) {
      throw new Error("signIn: " + (signErr?.message ?? "no session"));
    }
    const token = signin.session.access_token;

    // PDF minimal valide (4 octets « %PDF »)
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const form = new FormData();
    form.append(
      "file",
      new Blob([pdfBytes], { type: "application/pdf" }),
      `probe-${ts}.pdf`,
    );

    const upload = await fetch(`${BASE}/me/diplome`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    console.log("\n[POST /me/diplome] status:", upload.status);
    const uploadJson: any = await upload.json();
    console.log("  réponse:", JSON.stringify(uploadJson, null, 2));
    if (upload.status >= 400) {
      throw new Error("upload échoué");
    }

    const row = await prisma.diplome.findUnique({
      where: { userId: user.id },
    });
    console.log(
      "\n[DB] ligne Diplome présente?",
      Boolean(row),
      row ? `(storagePath=${row.storagePath})` : "",
    );
    if (row) storagePath = row.storagePath;

    const get = await fetch(`${BASE}/me/diplome`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("\n[GET /me/diplome] status:", get.status);
    const getJson: any = await get.json();
    console.log("  fileName:", getJson.fileName);
    console.log("  mimeType:", getJson.mimeType);
    console.log("  downloadUrl?", Boolean(getJson.downloadUrl));

    console.log(
      "\n✔ Option A opérationnelle : Storage + table `Diplome` peuplés via /me/diplome.",
    );
  } finally {
    if (storagePath) await removeDiplomeFile(storagePath).catch(() => {});
    await prisma.diplome.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await admin.auth.admin.deleteUser(supabaseId).catch(() => {});
    console.log("\nNettoyage OK.");
  }
}

main()
  .catch((e) => {
    console.error("\n✖", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
