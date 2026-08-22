/**
 * Valide age / sexe (inscription, PATCH /me, provision).
 *
 * `sexe` accepté uniquement : `femme` | `homme` (stocké en minuscules).
 */

export const SEXE_VALUES = ["femme", "homme"] as const;
export type SexeCanonique = (typeof SEXE_VALUES)[number];

export const SEXE_INVALID_MESSAGE = "sexe invalide : femme ou homme attendu";

function isSexeCanonique(value: string): value is SexeCanonique {
  return (SEXE_VALUES as readonly string[]).includes(value);
}

export function parseInscriptionDemographics(body: {
  age?: unknown;
  sexe?: unknown;
}):
  | { ok: true; age: number | null; sexe: SexeCanonique | null }
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

  let sexe: SexeCanonique | null = null;
  if (body.sexe !== undefined && body.sexe !== null && body.sexe !== "") {
    if (typeof body.sexe !== "string") {
      return { ok: false, message: SEXE_INVALID_MESSAGE };
    }
    const normalized = body.sexe.trim().toLowerCase();
    if (!isSexeCanonique(normalized)) {
      return { ok: false, message: SEXE_INVALID_MESSAGE };
    }
    sexe = normalized;
  }

  return { ok: true, age, sexe };
}
