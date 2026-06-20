import { besoinPrincipalDepuisReponses } from "../admin/questionnaireAggre";

const NIVEAU_ETUDE_KEYS = [
  "niveauEtude",
  "niveau_etude",
  "niveauEducation",
  "niveau_education",
  "niveauScolaire",
];

function stringFromValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Niveau d’études déclaré dans le questionnaire (libellé brut trimé). */
export function niveauEtudeDepuisReponses(reponses: unknown): string {
  if (!reponses || typeof reponses !== "object" || Array.isArray(reponses)) {
    return "";
  }
  const obj = reponses as Record<string, unknown>;
  for (const key of NIVEAU_ETUDE_KEYS) {
    const v = stringFromValue(obj[key]);
    if (v) return v;
  }
  return "";
}

/** Questionnaire considéré complet (besoin principal renseigné). */
export function questionnaireEstComplet(reponses: unknown): boolean {
  return besoinPrincipalDepuisReponses(reponses).length > 0;
}
