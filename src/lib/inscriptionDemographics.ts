/**
 * Valide age/sexe envoyés à l'inscription (optionnels).
 */
export function parseInscriptionDemographics(body: {
  age?: unknown;
  sexe?: unknown;
}):
  | { ok: true; age: number | null; sexe: string | null }
  | { ok: false; message: string } {
  let age: number | null = null;
  if (body.age !== undefined && body.age !== null && body.age !== "") {
    const n =
      typeof body.age === "number"
        ? body.age
        : typeof body.age === "string"
          ? Number.parseInt(body.age, 10)
          : NaN;
    if (!Number.isInteger(n) || n < 16 || n > 120) {
      return {
        ok: false,
        message: "age invalide (entier entre 16 et 120).",
      };
    }
    age = n;
  }

  let sexe: string | null = null;
  if (body.sexe !== undefined && body.sexe !== null && body.sexe !== "") {
    if (typeof body.sexe !== "string" || !body.sexe.trim()) {
      return { ok: false, message: "sexe invalide (string non vide)." };
    }
    sexe = body.sexe.trim();
  }

  return { ok: true, age, sexe };
}
