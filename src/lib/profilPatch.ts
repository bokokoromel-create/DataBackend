import type { Prisma } from "@prisma/client";
import { parseInscriptionDemographics } from "./inscriptionDemographics";

const PATCH_FIELDS = [
  "prenom",
  "nom",
  "ville",
  "arrondissement",
  "telephone",
  "age",
  "sexe",
] as const;

export function parseProfilPatch(body: unknown):
  | { ok: true; data: Prisma.UserUpdateInput }
  | { ok: false; message: string; error: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      message: "Body JSON invalide ou absent.",
      error: "INVALID_BODY",
    };
  }

  const obj = body as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return {
      ok: false,
      message: "Aucun champ à mettre à jour.",
      error: "EMPTY_BODY",
    };
  }

  for (const k of keys) {
    if (!(PATCH_FIELDS as readonly string[]).includes(k)) {
      return {
        ok: false,
        message: `Champ non autorisé : ${k}.`,
        error: "UNKNOWN_FIELD",
      };
    }
  }

  const data: Prisma.UserUpdateInput = {};

  if ("prenom" in obj) {
    if (typeof obj.prenom !== "string" || !obj.prenom.trim()) {
      return { ok: false, message: "prenom invalide (string non vide).", error: "VALIDATION" };
    }
    data.prenom = obj.prenom.trim();
  }

  if ("nom" in obj) {
    if (typeof obj.nom !== "string" || !obj.nom.trim()) {
      return { ok: false, message: "nom invalide (string non vide).", error: "VALIDATION" };
    }
    data.nom = obj.nom.trim();
  }

  if ("ville" in obj) {
    if (typeof obj.ville !== "string" || !obj.ville.trim()) {
      return { ok: false, message: "ville invalide (string non vide).", error: "VALIDATION" };
    }
    data.ville = obj.ville.trim();
  }

  if ("arrondissement" in obj) {
    if (obj.arrondissement === null || obj.arrondissement === "") {
      data.arrondissement = null;
    } else if (typeof obj.arrondissement === "string" && obj.arrondissement.trim()) {
      data.arrondissement = obj.arrondissement.trim();
    } else {
      return {
        ok: false,
        message: "arrondissement invalide (string ou null).",
        error: "VALIDATION",
      };
    }
  }

  if ("telephone" in obj) {
    if (obj.telephone === null || obj.telephone === "") {
      data.telephone = null;
    } else if (typeof obj.telephone === "string" && obj.telephone.trim()) {
      data.telephone = obj.telephone.trim();
    } else {
      return {
        ok: false,
        message: "telephone invalide (string ou null).",
        error: "VALIDATION",
      };
    }
  }

  if ("age" in obj) {
    if (obj.age === null || obj.age === "") {
      data.age = null;
    } else {
      const demo = parseInscriptionDemographics({ age: obj.age });
      if (!demo.ok) {
        return { ok: false, message: demo.message, error: "VALIDATION" };
      }
      data.age = demo.age;
    }
  }

  if ("sexe" in obj) {
    if (obj.sexe === null || obj.sexe === "") {
      data.sexe = null;
    } else {
      const demo = parseInscriptionDemographics({ sexe: obj.sexe });
      if (!demo.ok) {
        return { ok: false, message: demo.message, error: "VALIDATION" };
      }
      data.sexe = demo.sexe;
    }
  }

  return { ok: true, data };
}
