import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { signInUserWithPassword, supabase } from "../src/lib/supabase";

const BASE = process.env.PROBE_BASE_URL || "http://localhost:4000";
const PERIODE = process.argv[2] || "2026-06";

async function main() {
  console.log("Cible:", BASE, "| période:", PERIODE);

  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error("✖ API inaccessible sur", BASE);
    process.exitCode = 1;
    return;
  }
  console.log("✔ API online:", await health.text());

  const admin = await prisma.adminUser.findFirst({ select: { email: true } });
  if (!admin?.email) {
    console.error("✖ Aucun admin en base — crée un compte via POST /admin/register");
    process.exitCode = 1;
    return;
  }

  console.log("Admin test (email connu):", admin.email);
  console.log(
    "→ Pour tester avec ton mot de passe admin, passe PROBE_ADMIN_PASSWORD dans l’env.",
  );

  const password = process.env.PROBE_ADMIN_PASSWORD;
  if (!password) {
    const ts = Date.now();
    const email = `probe-rapport-${ts}@example.com`;
    const pwd = "ProbeRapport!123";
    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true,
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "createUser");
    await prisma.adminUser.create({
      data: {
        supabaseId: created.user.id,
        nomComplet: "Probe Rapport",
        email,
        nomOrganisation: "Probe",
        fonctionPoste: "Test",
        secteurInteret: "Test",
      },
    });
    try {
      await runProbe(email, pwd);
    } finally {
      await prisma.adminUser.delete({ where: { supabaseId: created.user.id } }).catch(() => {});
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
    }
    return;
  }

  await runProbe(admin.email, password);

  async function runProbe(email: string, pwd: string) {
    const { data, error } = await signInUserWithPassword(email, pwd);
    if (error || !data.session) {
      throw new Error("login admin: " + (error?.message ?? "no session"));
    }
    const token = data.session.access_token;

    const res = await fetch(`${BASE}/admin/rapports/${PERIODE}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("\n[GET /admin/rapports/" + PERIODE + "] status:", res.status);
    console.log("  Content-Type:", res.headers.get("content-type"));
    console.log(
      "  Content-Disposition:",
      res.headers.get("content-disposition"),
    );

    const text = await res.text();
    if (res.status >= 400) {
      console.log("  body:", text);
      process.exitCode = 1;
      return;
    }

    const lines = text.split(/\r?\n/);
    console.log("  lignes CSV:", lines.length);
    console.log("  en-tête:", lines[0]?.slice(0, 120));
    console.log("  extrait stats:", lines.slice(-6).join("\n    "));
    console.log("\n✔ Export rapport OK (CSV téléchargeable, ouvrable dans Excel).");
  }
}

main()
  .catch((e) => {
    console.error("✖", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
