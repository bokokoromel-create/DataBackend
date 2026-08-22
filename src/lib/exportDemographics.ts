import { Prisma } from "@prisma/client";

export type ExportDemographicFilter = {
  ageMin?: number;
  ageMax?: number;
  sexe?: string;
  arrondissement?: string;
  niveauEtude?: string;
};

function stringParam(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
}

function intParam(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  return Number.isInteger(n) ? n : undefined;
}

/** Query params communs à `/admin/export` et `/admin/stats`. */
export function exportFilterFromQuery(query: Record<string, unknown>): {
  filter: ExportDemographicFilter;
  prismaWhere: Prisma.UserWhereInput;
  error: string | null;
} {
  const filter: ExportDemographicFilter = {};
  const prismaWhere: Prisma.UserWhereInput = {};

  const ageMin = intParam(query.ageMin);
  const ageMax = intParam(query.ageMax);
  if (query.ageMin !== undefined && ageMin === undefined) {
    return { filter, prismaWhere, error: "Paramètre ageMin invalide (entier)." };
  }
  if (query.ageMax !== undefined && ageMax === undefined) {
    return { filter, prismaWhere, error: "Paramètre ageMax invalide (entier)." };
  }
  if (ageMin !== undefined) filter.ageMin = ageMin;
  if (ageMax !== undefined) filter.ageMax = ageMax;

  if (ageMin !== undefined || ageMax !== undefined) {
    prismaWhere.age = {};
    if (ageMin !== undefined) prismaWhere.age.gte = ageMin;
    if (ageMax !== undefined) prismaWhere.age.lte = ageMax;
  }

  const sexe = stringParam(query.sexe);
  if (sexe) {
    // Canonique : homme | femme (insensible à la casse côté query).
    const sexeNorm = sexe.toLowerCase();
    filter.sexe = sexeNorm;
    prismaWhere.sexe = { equals: sexeNorm, mode: "insensitive" };
  }

  const arrondissement = stringParam(query.arrondissement);
  if (arrondissement) {
    filter.arrondissement = arrondissement;
    prismaWhere.arrondissement = {
      equals: arrondissement,
      mode: "insensitive",
    };
  }

  const niveauEtude = stringParam(query.niveauEtude);
  if (niveauEtude) {
    filter.niveauEtude = niveauEtude;
  }

  return { filter, prismaWhere, error: null };
}

/** Filtre post-requête sur niveauEtude (champ JSON questionnaire). */
export function matchesNiveauEtudeFilter(
  niveauEtude: string,
  expected: string | undefined,
): boolean {
  if (!expected) return true;
  return (
    niveauEtude.localeCompare(expected, "fr", {
      sensitivity: "accent",
    }) === 0
  );
}
