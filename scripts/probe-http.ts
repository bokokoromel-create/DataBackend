import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { supabase } from "../src/lib/supabase";

const BASE = process.env.PROBE_BASE_URL || "http://localhost:4000";
const email = `probe-admin-${Date.now()}@example.com`;
const password = "Probe!Passw0rd123";

async function main() {
  console.log("Cible:", BASE);

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createErr || !created.user) {
    throw new Error("createUser: " + (createErr?.message ?? "no user"));
  }
  const supabaseId = created.user.id;

  await prisma.adminUser.create({
    data: {
      supabaseId,
      nomComplet: "Probe Admin",
      email,
      nomOrganisation: "Probe",
      fonctionPoste: "Test",
      secteurInteret: "Test",
    },
  });

  try {
    const { data: signin, error: signErr } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signErr || !signin.session) {
      throw new Error("signIn: " + (signErr?.message ?? "no session"));
    }
    const token = signin.session.access_token;
    const headers = { Authorization: `Bearer ${token}` };

    const exportRes = await fetch(`${BASE}/admin/export`, { headers });
    console.log("\n[GET /admin/export] status:", exportRes.status);
    const exportJson: any = await exportRes.json();
    const first = exportJson?.participants?.[0];
    if (first) {
      console.log("  1er participant -> champs présents:");
      console.log("    besoinPrincipal:", JSON.stringify(first.besoinPrincipal));
      console.log("    obstacles:", JSON.stringify(first.obstacles));
      console.log("    obstaclesText:", JSON.stringify(first.obstaclesText));
    } else {
      console.log("  (aucun participant)");
    }

    const statsRes = await fetch(`${BASE}/admin/stats`, { headers });
    console.log("\n[GET /admin/stats] status:", statsRes.status);
    const statsJson: any = await statsRes.json();
    console.log("  totalObstaclesSelectionnes:", statsJson.totalObstaclesSelectionnes);
    console.log("  besoinsParType:", JSON.stringify(statsJson.besoinsParType));
  } finally {
    await prisma.adminUser.delete({ where: { supabaseId } }).catch(() => {});
    await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    console.log("\nNettoyage admin de test OK.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
