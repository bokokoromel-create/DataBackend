/**
 * Peuple `ZoneAdministrative` (type SECTEUR) avec les 15 arrondissements déjà
 * utilisés dans les formulaires (`profil-form-options.ts` côté front).
 *
 * Coordonnées approximatives (centroïdes indicatifs pour la carte admin,
 * pas des limites officielles) — affinables plus tard via une future UI
 * d'administration des zones. Idempotent : `upsert` sur `[ville, type, nom]`.
 *
 * Usage : `npx ts-node scripts/seed-zones-administratives.ts`
 */
import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { TypeZoneAdministrative } from "@prisma/client";

type SecteurSeed = {
  ville: string;
  nom: string;
  latitude: number;
  longitude: number;
};

const SECTEURS_BRAZZAVILLE: SecteurSeed[] = [
  { ville: "Brazzaville", nom: "Makélékélé", latitude: -4.2781, longitude: 15.2075 },
  { ville: "Brazzaville", nom: "Bacongo", latitude: -4.2870, longitude: 15.2540 },
  { ville: "Brazzaville", nom: "Poto-Poto", latitude: -4.2661, longitude: 15.2831 },
  { ville: "Brazzaville", nom: "Moungali", latitude: -4.2522, longitude: 15.2722 },
  { ville: "Brazzaville", nom: "Ouenzé", latitude: -4.2333, longitude: 15.2833 },
  { ville: "Brazzaville", nom: "Talangaï", latitude: -4.2322, longitude: 15.2875 },
  { ville: "Brazzaville", nom: "Mfilou", latitude: -4.2667, longitude: 15.1833 },
  { ville: "Brazzaville", nom: "Madibou", latitude: -4.3100, longitude: 15.1917 },
  { ville: "Brazzaville", nom: "Djiri", latitude: -4.1619, longitude: 15.2794 },
];

const SECTEURS_POINTE_NOIRE: SecteurSeed[] = [
  { ville: "Pointe-Noire", nom: "Lumumba", latitude: -4.7889, longitude: 11.8656 },
  { ville: "Pointe-Noire", nom: "Mvoumvou", latitude: -4.8100, longitude: 11.8550 },
  { ville: "Pointe-Noire", nom: "Tié-Tié", latitude: -4.8000, longitude: 11.8200 },
  { ville: "Pointe-Noire", nom: "Loandjili", latitude: -4.7700, longitude: 11.8850 },
  { ville: "Pointe-Noire", nom: "Mongo-Mpoukou", latitude: -4.7500, longitude: 11.8700 },
  { ville: "Pointe-Noire", nom: "Ngoyo", latitude: -4.8300, longitude: 11.8400 },
];

const TOUS_LES_SECTEURS = [...SECTEURS_BRAZZAVILLE, ...SECTEURS_POINTE_NOIRE];

async function main() {
  let crees = 0;
  let misAJour = 0;

  for (const secteur of TOUS_LES_SECTEURS) {
    const cle = {
      ville_type_nom: {
        ville: secteur.ville,
        type: TypeZoneAdministrative.SECTEUR,
        nom: secteur.nom,
      },
    };
    const existant = await prisma.zoneAdministrative.findUnique({ where: cle });
    await prisma.zoneAdministrative.upsert({
      where: cle,
      update: { latitude: secteur.latitude, longitude: secteur.longitude, actif: true },
      create: {
        type: TypeZoneAdministrative.SECTEUR,
        nom: secteur.nom,
        ville: secteur.ville,
        latitude: secteur.latitude,
        longitude: secteur.longitude,
      },
    });
    if (existant) misAJour += 1;
    else crees += 1;
  }

  console.log(
    `Zones administratives (secteurs) : ${crees} créées, ${misAJour} mises à jour (total ${TOUS_LES_SECTEURS.length}).`,
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
