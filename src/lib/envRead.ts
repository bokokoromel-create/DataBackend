/**
 * Lecture normalisée des variables d’environnement (trim, BOM, CR, guillemets parasites).
 */

export function normalizeScalar(raw: string): string {
  let u = raw.trim().replace(/\r/g, "");
  if (u.charCodeAt(0) === 0xfeff) {
    u = u.slice(1).trim().replace(/\r/g, "");
  }
  while (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'"))
  ) {
    u = u.slice(1, -1).trim().replace(/\r/g, "");
  }
  return u;
}

/** Retourne `undefined` si la variable est absente ou vide après normalisation. */
export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const v = normalizeScalar(raw);
  return v === "" ? undefined : v;
}
