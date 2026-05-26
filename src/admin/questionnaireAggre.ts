/**
 * Agrégats dashboard à partir de `Questionnaire.reponses` (JSON libre).
 * Clés alignées sur les formulaires front courants (besoins, obstacles, ville user).
 */

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

export type ComptageLabel = { label: string; count: number };

export type PrioriteParZone = {
  ville: string;
  besoinPrincipal: string;
  obstacles: number;
};

export type StatsQuestionnairesDetail = {
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

function besoinsDepuisReponses(reponses: unknown): string[] {
  if (!reponses || typeof reponses !== "object" || Array.isArray(reponses)) {
    return [];
  }
  const obj = reponses as Record<string, unknown>;
  const fromArrays = collectFromKeys(obj, BESOIN_ARRAY_KEYS);
  const fromSingles = collectFromKeys(obj, BESOIN_SINGLE_KEYS);
  return [...fromArrays, ...fromSingles];
}

function obstaclesDepuisReponses(reponses: unknown): string[] {
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

export function aggreStatsQuestionnaires(
  rows: { ville: string; reponses: unknown }[],
): StatsQuestionnairesDetail {
  const besoinsGlobal = new Map<string, number>();
  let totalObstaclesSelectionnes = 0;

  const parVille = new Map<
    string,
    { besoins: Map<string, number>; obstacles: number }
  >();

  for (const { ville, reponses } of rows) {
    const besoins = besoinsDepuisReponses(reponses);
    const obstacles = obstaclesDepuisReponses(reponses);
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

  const besoinsParType = [...besoinsGlobal.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));

  const prioritesParZone = [...parVille.entries()]
    .map(([ville, data]) => ({
      ville,
      besoinPrincipal: modeLabel(data.besoins),
      obstacles: data.obstacles,
    }))
    .sort((a, b) => a.ville.localeCompare(b.ville, "fr"));

  return {
    totalObstaclesSelectionnes,
    besoinsParType,
    prioritesParZone,
  };
}
