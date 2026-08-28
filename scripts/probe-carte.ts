/**
 * Vérifie rapidement GET /admin/zones et GET /admin/carte contre une API en
 * cours d'exécution (par défaut http://localhost:4000). Crée un admin
 * jetable si PROBE_ADMIN_PASSWORD n'est pas fourni pour un admin existant.
 *
 * Usage : npx ts-node scripts/probe-carte.ts
 */
import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { signInUserWithPassword, supabase } from "../src/lib/supabase";

const BASE = process.env.PROBE_BASE_URL || "http://localhost:4000";

async function main() {
  console.log("Cible:", BASE);

  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error("✖ API inaccessible sur", BASE);
    process.exitCode = 1;
    return;
  }
  console.log("✔ API online:", await health.text());

  const ts = Date.now();
  const email = `probe-carte-${ts}@example.com`;
  const pwd = "ProbeCarte!123";
  const { data: created, error: cErr } = await supabase.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(cErr?.message ?? "createUser");
  await prisma.adminUser.create({
    data: {
      supabaseId: created.user.id,
      nomComplet: "Probe Carte",
      email,
      nomOrganisation: "Probe",
      fonctionPoste: "Test",
      secteurInteret: "Test",
    },
  });

  try {
    const { data, error } = await signInUserWithPassword(email, pwd);
    if (error || !data.session) {
      throw new Error("login admin: " + (error?.message ?? "no session"));
    }
    const token = data.session.access_token;
    const headers = { Authorization: `Bearer ${token}` };

    const zonesRes = await fetch(`${BASE}/admin/zones`, { headers });
    console.log("\n[GET /admin/zones] status:", zonesRes.status);
    const zones = await zonesRes.json();
    console.log("  longueur:", Array.isArray(zones) ? zones.length : "n/a");
    console.log("  exemple:", JSON.stringify(zones[0]));

    const zonesBzvRes = await fetch(`${BASE}/admin/zones?ville=Brazzaville`, {
      headers,
    });
    const zonesBzv = await zonesBzvRes.json();
    console.log(
      "[GET /admin/zones?ville=Brazzaville] status:",
      zonesBzvRes.status,
      "longueur:",
      Array.isArray(zonesBzv) ? zonesBzv.length : "n/a",
    );

    const carteRes = await fetch(`${BASE}/admin/carte`, { headers });
    console.log("\n[GET /admin/carte] status:", carteRes.status);
    const carte = await carteRes.json();
    console.log("  body:", JSON.stringify(carte, null, 2));

    if (
      zonesRes.status === 200 &&
      Array.isArray(zones) &&
      zones.length === 15 &&
      carteRes.status === 200 &&
      carte.seuilConfidentialite === 3
    ) {
      console.log("\n✔ Carte admin OK.");
    } else {
      console.error("\n✖ Résultat inattendu (voir ci-dessus).");
      process.exitCode = 1;
    }
  } finally {
    await prisma.adminUser
      .delete({ where: { supabaseId: created.user.id } })
      .catch(() => {});
    await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
  }
}

main()
  .catch((e) => {
    console.error("✖", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
