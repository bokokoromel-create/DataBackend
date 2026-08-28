/**
 * Backfill : résout `zoneAdministrativeId` pour tous les utilisateurs déjà
 * existants (créés avant l'introduction de `ZoneAdministrative`), à partir de
 * leurs `ville` + `arrondissement` en texte libre.
 *
 * Idempotent, sans effet sur les utilisateurs déjà résolus (sauf si leur
 * arrondissement a changé de correspondance entre-temps).
 *
 * Usage : `npx ts-node scripts/backfill-zones-utilisateurs.ts`
 */
import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { resolveZoneAdministrativeId } from "../src/lib/zoneAdministrative";

async function main() {
  const utilisateurs = await prisma.user.findMany({
    select: { id: true, ville: true, arrondissement: true, zoneAdministrativeId: true },
  });

  let misAJour = 0;
  let inchanges = 0;
  let nonResolus = 0;

  for (const u of utilisateurs) {
    const zoneAdministrativeId = await resolveZoneAdministrativeId(
      u.ville,
      u.arrondissement,
    );

    if (zoneAdministrativeId === u.zoneAdministrativeId) {
      inchanges += 1;
      continue;
    }

    if (!zoneAdministrativeId) {
      nonResolus += 1;
      continue;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { zoneAdministrativeId },
    });
    misAJour += 1;
  }

  console.log(
    `Backfill zones : ${misAJour} mis à jour, ${inchanges} déjà à jour, ${nonResolus} non résolus (arrondissement absent/inconnu), sur ${utilisateurs.length} utilisateurs.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
