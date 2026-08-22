import type { Prisma } from "@prisma/client";
import {
  parseInscriptionDemographics,
  SEXE_INVALID_MESSAGE,
} from "./inscriptionDemographics";

const PROVISION_REQUIRED = ["prenom", "nom", "ville"] as const;

const PROVISION_FIELDS = [
  ...PROVISION_REQUIRED,
  "arrondissement",
  "telephone",
  "age",
  "sexe",
] as const;

export function parseProfilProvision(body: unknown):
  | { ok: true; data: Omit<Prisma.UserCreateInput, "supabaseId" | "email"> }
  | { ok: false; message: string; error: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      message: "Body JSON invalide ou absent.",
      error: "INVALID_BODY",
    };
  }

  const obj = body as Record<string, unknown>;

  for (const field of PROVISION_REQUIRED) {
    if (typeof obj[field] !== "string" || !String(obj[field]).trim()) {
      return {
        ok: false,
        message: `Champ requis : ${field} (string non vide).`,
        error: "VALIDATION_MISSING_FIELDS",
      };
    }
  }

  for (const k of Object.keys(obj)) {
    if (!(PROVISION_FIELDS as readonly string[]).includes(k)) {
      return {
        ok: false,
        message: `Champ non autorisé : ${k}.`,
        error: "UNKNOWN_FIELD",
      };
    }
  }

  const demo = parseInscriptionDemographics({ age: obj.age, sexe: obj.sexe });
  if (!demo.ok) {
    return {
      ok: false,
      message: demo.message,
      error:
        demo.message === SEXE_INVALID_MESSAGE
          ? "VALIDATION_SEXE"
          : "VALIDATION_DEMOGRAPHICS",
    };
  }

  let arrondissement: string | null = null;
  if (
    obj.arrondissement !== undefined &&
    obj.arrondissement !== null &&
    obj.arrondissement !== ""
  ) {
    if (typeof obj.arrondissement !== "string" || !obj.arrondissement.trim()) {
      return {
        ok: false,
        message: "arrondissement invalide (string ou null).",
        error: "VALIDATION",
      };
    }
    arrondissement = obj.arrondissement.trim();
  }

  let telephone: string | null = null;
  if (
    obj.telephone !== undefined &&
    obj.telephone !== null &&
    obj.telephone !== ""
  ) {
    if (typeof obj.telephone !== "string" || !obj.telephone.trim()) {
      return {
        ok: false,
        message: "telephone invalide (string ou null).",
        error: "VALIDATION",
      };
    }
    telephone = obj.telephone.trim();
  }

  return {
    ok: true,
    data: {
      prenom: String(obj.prenom).trim(),
      nom: String(obj.nom).trim(),
      ville: String(obj.ville).trim(),
      arrondissement,
      telephone,
      age: demo.age,
      sexe: demo.sexe,
    },
  };
}
