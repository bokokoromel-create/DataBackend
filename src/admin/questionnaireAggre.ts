/**
 * Agrégats dashboard à partir de `Questionnaire.reponses` (JSON libre).
 * Clés alignées sur les formulaires front courants (besoins, obstacles, ville user).
 */

export const BESOINS_CANONIQUES = [
  "Trouver un emploi",
  "Accéder à une formation",
  "Lancer une activité",
  "Obtenir un financement",
] as const;

export type BesoinCanonique = (typeof BESOINS_CANONIQUES)[number];

const BESOIN_ARRAY_KEYS = [
  "besoins",
  "typesBesoins",
  "besoinsSelectionnes",
  "besoinTypes",
  "typesDeBesoins",
];

const BESOIN_SINGLE_KEYS = [
  "besoinPrincipal",
  "typeBesoin",
  "besoin",
  "besoinPrioritaire",
];

const OBSTACLE_KEYS = [
  "obstacles",
  "obstaclesSelectionnes",
  "obstacleSelectionnes",
  "obstacle",
];

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const BESOIN_ALIAS_BY_SLUG: Record<string, BesoinCanonique> = {};
for (const c of BESOINS_CANONIQUES) BESOIN_ALIAS_BY_SLUG[slug(c)] = c;
BESOIN_ALIAS_BY_SLUG[slug("Emploi")] = "Trouver un emploi";
BESOIN_ALIAS_BY_SLUG[slug("Trouver emploi")] = "Trouver un emploi";
BESOIN_ALIAS_BY_SLUG[slug("Formation")] = "Accéder à une formation";
BESOIN_ALIAS_BY_SLUG[slug("Acceder à une formation")] = "Accéder à une formation";
BESOIN_ALIAS_BY_SLUG[slug("Activité")] = "Lancer une activité";
BESOIN_ALIAS_BY_SLUG[slug("Lancer activité")] = "Lancer une activité";
BESOIN_ALIAS_BY_SLUG[slug("Financement")] = "Obtenir un financement";
BESOIN_ALIAS_BY_SLUG[slug("Obtenir financement")] = "Obtenir un financement";

/** Renvoie le libellé canonique s’il est connu, sinon le label nettoyé tel quel. */
export function canonBesoinLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const s = slug(trimmed);
  return BESOIN_ALIAS_BY_SLUG[s] ?? trimmed;
}

export type ComptageLabel = { label: string; count: number };

export type PrioriteParZone = {
  ville: string;
  besoinPrincipal: string;
  obstacles: number;
};

export type StatsQuestionnairesDetail = {
  totalQuestionnairesActifs: number;
  totalObstaclesSelectionnes: number;
  besoinsParType: ComptageLabel[];
  prioritesParZone: PrioriteParZone[];
};

function extractStringLabels(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    // Chaîne JSON encodée : '["Manque de formation"]' ou '"Manque de formation"'
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return extractStringLabels(parsed);
      } catch {
        /* libellé brut */
      }
    }
    // "A ; B" (format export texte parfois renvoyé par le front)
    if (trimmed.includes(" ; ")) {
      return trimmed
        .split(" ; ")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractStringLabels);
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.label === "string" && o.label.trim()) {
      return [o.label.trim()];
    }
    if (typeof o.libelle === "string" && o.libelle.trim()) {
      return [o.libelle.trim()];
    }
    if (typeof o.nom === "string" && o.nom.trim()) {
      return [o.nom.trim()];
    }
    return Object.values(o).flatMap(extractStringLabels);
  }
  return [];
}

function collectFromKeys(
  obj: Record<string, unknown>,
  keys: string[],
): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (k in obj) {
      out.push(...extractStringLabels(obj[k]));
    }
  }
  return out;
}

/** Tous les besoins évoqués dans le questionnaire (tableau de libellés canoniques quand possible). */
export function besoinsDepuisReponses(reponses: unknown): string[] {
  const obj = normalizeReponses(reponses);
  if (!obj) return [];
  const all = [
    ...collectFromKeys(obj, BESOIN_ARRAY_KEYS),
    ...collectFromKeys(obj, BESOIN_SINGLE_KEYS),
  ];
  return all.map(canonBesoinLabel).filter((s) => s.length > 0);
}

/** Besoin principal déclaré (canonique). Vide si non renseigné. */
export function besoinPrincipalDepuisReponses(reponses: unknown): string {
  const obj = normalizeReponses(reponses);
  if (!obj) return "";
  const singles = collectFromKeys(obj, BESOIN_SINGLE_KEYS);
  if (singles.length > 0) {
    const canon = canonBesoinLabel(singles[0]);
    if (canon) return canon;
  }
  // fallback : 1er élément des tableaux
  const arrays = collectFromKeys(obj, BESOIN_ARRAY_KEYS);
  if (arrays.length > 0) {
    const canon = canonBesoinLabel(arrays[0]);
    if (canon) return canon;
  }
  return "";
}

/** Liste textuelle des obstacles cochés (libellés bruts trimés). */
export function obstaclesDepuisReponses(reponses: unknown): string[] {
  const normalized = normalizeReponses(reponses);
  if (!normalized) return [];
  return collectFromKeys(normalized, OBSTACLE_KEYS);
}

/** Normalise `reponses` si la colonne JSON a été stockée en string. */
export function normalizeReponses(
  reponses: unknown,
): Record<string, unknown> | null {
  if (!reponses) return null;
  if (typeof reponses === "string") {
    try {
      const parsed: unknown = JSON.parse(reponses);
      return normalizeReponses(parsed);
    } catch {
      return null;
    }
  }
  if (typeof reponses !== "object" || Array.isArray(reponses)) return null;
  return reponses as Record<string, unknown>;
}

/** Questionnaire comptabilisable : statut renseigné OU besoinPrincipal. */
export function questionnaireEstActif(reponses: unknown): boolean {
  const normalized = normalizeReponses(reponses);
  if (!normalized) return false;
  if (besoinPrincipalDepuisReponses(normalized)) return true;
  // Import circulaire évité : test local des clés statut
  for (const cle of [
    "statutProfessionnel",
    "situationProfessionnelle",
    "parcoursProfessionnel",
    "situation",
    "statut",
  ]) {
    const v = normalized[cle];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}

function incrementMap(map: Map<string, number>, labels: string[]) {
  for (const label of labels) {
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
}

export function modeLabel(counts: Map<string, number>): string {
  let best = "Non renseigné";
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

/** Garantit la présence des 4 libellés canoniques (count 0 si absent), suivi des éventuels libellés libres. */
function withCanonical(counts: Map<string, number>): ComptageLabel[] {
  const out: ComptageLabel[] = BESOINS_CANONIQUES.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));

  const extra: ComptageLabel[] = [];
  for (const [label, count] of counts) {
    if ((BESOINS_CANONIQUES as readonly string[]).includes(label)) continue;
    extra.push({ label, count });
  }
  extra.sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"),
  );

  return [...out, ...extra];
}

export function aggreStatsQuestionnaires(
  rows: { ville: string; reponses: unknown }[],
): StatsQuestionnairesDetail {
  const besoinsGlobal = new Map<string, number>();
  let totalObstaclesSelectionnes = 0;
  let totalQuestionnairesActifs = 0;

  const parVille = new Map<
    string,
    { besoinsPrincipaux: Map<string, number>; obstacles: number }
  >();

  for (const { ville, reponses } of rows) {
    const besoinPrincipal = besoinPrincipalDepuisReponses(reponses);
    const obstacles = obstaclesDepuisReponses(reponses);

    // MAJ-2026-08-23 : compter si statut OU besoinPrincipal
    if (questionnaireEstActif(reponses)) totalQuestionnairesActifs += 1;
    totalObstaclesSelectionnes += obstacles.length;

    // besoinsParType : priorité au besoinPrincipal (1 vote / questionnaire)
    if (besoinPrincipal) {
      incrementMap(besoinsGlobal, [besoinPrincipal]);
    } else {
      incrementMap(besoinsGlobal, besoinsDepuisReponses(reponses));
    }

    const villeNorm = ville.trim() || "Non renseigné";
    if (!parVille.has(villeNorm)) {
      parVille.set(villeNorm, { besoinsPrincipaux: new Map(), obstacles: 0 });
    }
    const bucket = parVille.get(villeNorm)!;
    if (besoinPrincipal) {
      incrementMap(bucket.besoinsPrincipaux, [besoinPrincipal]);
    }
    bucket.obstacles += obstacles.length;
  }

  const besoinsParType = withCanonical(besoinsGlobal);

  const prioritesParZone = [...parVille.entries()]
    .map(([ville, data]) => ({
      ville,
      besoinPrincipal: modeLabel(data.besoinsPrincipaux),
      obstacles: data.obstacles,
    }))
    .sort((a, b) => a.ville.localeCompare(b.ville, "fr"));

  return {
    totalQuestionnairesActifs,
    totalObstaclesSelectionnes,
    besoinsParType,
    prioritesParZone,
  };
}
