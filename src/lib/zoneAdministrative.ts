/**
 * Résolution de la zone administrative (secteur) correspondant à une paire
 * `ville` + `arrondissement` en texte libre, telle que saisie via les
 * formulaires d'inscription/profil (front `lib/profil-form-options.ts`).
 *
 * Utilisé pour alimenter `User.zoneAdministrativeId`, consommé ensuite par
 * la carte admin (`GET /admin/carte`). Additif et tolérant : une valeur non
 * reconnue (faute de frappe, ville hors référentiel…) renvoie simplement
 * `null` sans bloquer l'inscription ou la mise à jour de profil.
 */
import { TypeZoneAdministrative } from "@prisma/client";
import { prisma } from "./prisma";

function normaliser(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Retrouve l'id de la `ZoneAdministrative` (type SECTEUR) correspondant à
 * `ville` + `arrondissement`. Comparaison insensible à la casse et aux accents
 * pour tolérer les petites variations de saisie.
 */
export async function resolveZoneAdministrativeId(
  ville: string | null | undefined,
  arrondissement: string | null | undefined,
): Promise<string | null> {
  const villeTrim = ville?.trim();
  const arrondissementTrim = arrondissement?.trim();
  if (!villeTrim || !arrondissementTrim) return null;

  const secteurs = await prisma.zoneAdministrative.findMany({
    where: {
      type: TypeZoneAdministrative.SECTEUR,
      actif: true,
    },
    select: { id: true, ville: true, nom: true },
  });

  const villeCible = normaliser(villeTrim);
  const nomCible = normaliser(arrondissementTrim);

  const trouve = secteurs.find(
    (z) => normaliser(z.ville) === villeCible && normaliser(z.nom) === nomCible,
  );

  return trouve?.id ?? null;
}
