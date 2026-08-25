/**
 * Extrait une situation « profession » depuis `Questionnaire.reponses` (JSON libre).
 * Adaptez les clés / alias si votre questionnaire utilise d’autres identifiants côté front.
 */

const SORTIE = [
  "Étudiant",
  "Sans emploi",
  "Employé",
  "Entrepreneur",
  "Non renseigné",
] as const;

export type StatutProfessionnelAggrege = (typeof SORTIE)[number];

const ALIAS_PAR_LIBELLE: Record<string, StatutProfessionnelAggrege> = {
  etudiant: "Étudiant",
  "sans emploi": "Sans emploi",
  "sansemploi": "Sans emploi",
  sans_emploi: "Sans emploi",
  emploi: "Employé",
  employé: "Employé",
  employe: "Employé",
  entrepreneur: "Entrepreneur",
};

const CLES_TRIEES_PAR_PRIORITE = [
  "statutProfessionnel",
  "situationProfessionnelle",
  "parcoursProfessionnel",
  "situation",
  "statut",
];

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Parcourt quelques niveaux pour trouver une string candidate. */
function collectStringCandidates(
  value: unknown,
  depth = 2,
): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  if (depth <= 0 || value == null || typeof value !== "object") {
    return [];
  }
  const out: string[] = [];
  for (const v of Object.values(value as Record<string, unknown>)) {
    out.push(...collectStringCandidates(v, depth - 1));
  }
  return out;
}

function classeDepuisLibelleOuAlias(raw: string): StatutProfessionnelAggrege {
  const s = slug(raw);
  if (ALIAS_PAR_LIBELLE[s]) {
    return ALIAS_PAR_LIBELLE[s];
  }
  for (const ligne of SORTIE) {
    if (ligne === "Non renseigné") continue;
    if (s === slug(ligne)) {
      return ligne;
    }
  }
  return "Non renseigné";
}

/**
 * À partir du JSON questionnaire, classe le participant pour l’export dashboard.
 */
export function statutDepuisReponses(
  reponses: unknown | null | undefined,
): StatutProfessionnelAggrege {
  let data = reponses;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return "Non renseigné";
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Non renseigné";
  }
  const obj = data as Record<string, unknown>;

  for (const cle of CLES_TRIEES_PAR_PRIORITE) {
    const v = obj[cle];
    if (typeof v === "string" && v.trim()) {
      const c = classeDepuisLibelleOuAlias(v);
      if (c !== "Non renseigné") return c;
    }
  }

  for (const s of collectStringCandidates(data)) {
    const c = classeDepuisLibelleOuAlias(s);
    if (c !== "Non renseigné") return c;
  }

  return "Non renseigné";
}

export function statutsOrdonnesAggre(): StatutProfessionnelAggrege[] {
  return [...SORTIE];
}
