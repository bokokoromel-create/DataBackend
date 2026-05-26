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
    return [value.trim()];
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
  if (!reponses || typeof reponses !== "object" || Array.isArray(reponses)) {
    return [];
  }
  const obj = reponses as Record<string, unknown>;
  const all = [
    ...collectFromKeys(obj, BESOIN_ARRAY_KEYS),
    ...collectFromKeys(obj, BESOIN_SINGLE_KEYS),
  ];
  return all.map(canonBesoinLabel).filter((s) => s.length > 0);
}

/** Besoin principal déclaré (canonique). Vide si non renseigné. */
export function besoinPrincipalDepuisReponses(reponses: unknown): string {
  if (!reponses || typeof reponses !== "object" || Array.isArray(reponses)) {
    return "";
  }
  const obj = reponses as Record<string, unknown>;
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
  if (!reponses || typeof reponses !== "object" || Array.isArray(reponses)) {
    return [];
  }
  return collectFromKeys(reponses as Record<string, unknown>, OBSTACLE_KEYS);
}

function incrementMap(map: Map<string, number>, labels: string[]) {
  for (const label of labels) {
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
}

function modeLabel(counts: Map<string, number>): string {
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
    { besoins: Map<string, number>; obstacles: number }
  >();

  for (const { ville, reponses } of rows) {
    const besoins = besoinsDepuisReponses(reponses);
    const obstacles = obstaclesDepuisReponses(reponses);
    const besoinPrincipal = besoinPrincipalDepuisReponses(reponses);

    if (besoinPrincipal) totalQuestionnairesActifs += 1;
    totalObstaclesSelectionnes += obstacles.length;

    incrementMap(besoinsGlobal, besoins);

    const villeNorm = ville.trim() || "Non renseigné";
    if (!parVille.has(villeNorm)) {
      parVille.set(villeNorm, { besoins: new Map(), obstacles: 0 });
    }
    const bucket = parVille.get(villeNorm)!;
    incrementMap(bucket.besoins, besoins);
    bucket.obstacles += obstacles.length;
  }

  const besoinsParType = withCanonical(besoinsGlobal);

  const prioritesParZone = [...parVille.entries()]
    .map(([ville, data]) => ({
      ville,
      besoinPrincipal: modeLabel(data.besoins),
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
