import { besoinPrincipalDepuisReponses } from "../admin/questionnaireAggre";

export const THEMATIQUES_CANONIQUES = [
  "Emploi",
  "Formation",
  "Entrepreneuriat",
  "Numérique",
  "Santé",
  "Participation citoyenne",
] as const;

export type ThematiqueCanonique = (typeof THEMATIQUES_CANONIQUES)[number];

const THEMATIQUE_ARRAY_KEYS = [
  "thematique",
  "thematiques",
  "centresInteret",
  "centresInterets",
  "interets",
  "domainesInteret",
  "domaines",
];

const BESOIN_TO_THEMATIQUE: Record<string, ThematiqueCanonique> = {
  "trouver un emploi": "Emploi",
  "acceder a une formation": "Formation",
  "acceder à une formation": "Formation",
  "lancer une activite": "Entrepreneuriat",
  "lancer une activité": "Entrepreneuriat",
  "obtenir un financement": "Entrepreneuriat",
};

const ALIAS_TO_THEMATIQUE: Record<string, ThematiqueCanonique> = {
  emploi: "Emploi",
  "trouver emploi": "Emploi",
  travail: "Emploi",
  formation: "Formation",
  "acces formation": "Formation",
  entrepreneuriat: "Entrepreneuriat",
  "lancer activite": "Entrepreneuriat",
  activite: "Entrepreneuriat",
  numerique: "Numérique",
  digital: "Numérique",
  "technologies numeriques": "Numérique",
  informatique: "Numérique",
  sante: "Santé",
  "sante publique": "Santé",
  medical: "Santé",
  "participation citoyenne": "Participation citoyenne",
  citoyennete: "Participation citoyenne",
  citoyenneté: "Participation citoyenne",
  gouvernance: "Participation citoyenne",
};

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractLabels(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.flatMap(extractLabels);
  return [];
}

function canonThematique(raw: string): ThematiqueCanonique | null {
  const s = slug(raw);
  if (ALIAS_TO_THEMATIQUE[s]) return ALIAS_TO_THEMATIQUE[s];
  for (const t of THEMATIQUES_CANONIQUES) {
    if (slug(t) === s) return t;
  }
  return null;
}

/** Thématiques déclarées dans un questionnaire (0..n par réponse). */
export function thematiquesDepuisReponses(reponses: unknown): ThematiqueCanonique[] {
  const found = new Set<ThematiqueCanonique>();

  if (reponses && typeof reponses === "object" && !Array.isArray(reponses)) {
    const obj = reponses as Record<string, unknown>;
    for (const key of THEMATIQUE_ARRAY_KEYS) {
      for (const label of extractLabels(obj[key])) {
        const canon = canonThematique(label);
        if (canon) found.add(canon);
      }
    }
  }

  const besoin = besoinPrincipalDepuisReponses(reponses);
  if (besoin) {
    const mapped = BESOIN_TO_THEMATIQUE[slug(besoin)];
    if (mapped) found.add(mapped);
  }

  return [...found];
}

export type ComptageThematique = { thematique: ThematiqueCanonique; count: number };

/** Agrégat par thématique (6 libellés canoniques, count 0 si absent). */
export function aggreParThematique(
  rows: { reponses: unknown }[],
): ComptageThematique[] {
  const counts = new Map<ThematiqueCanonique, number>();
  for (const t of THEMATIQUES_CANONIQUES) counts.set(t, 0);

  for (const { reponses } of rows) {
    const themes = thematiquesDepuisReponses(reponses);
    if (themes.length === 0) continue;
    for (const t of themes) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return THEMATIQUES_CANONIQUES.map((thematique) => ({
    thematique,
    count: counts.get(thematique) ?? 0,
  }));
}
