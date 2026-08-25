/**
 * Résolution « tolérante » du profil participant pour un JWT Auth valide.
 *
 * Un compte Supabase Auth peut exister sans ligne `User` (inscription interrompue,
 * compte créé hors du flux `POST /inscription`). Les routes d'écriture `/me/*`
 * renvoyaient alors 404 et perdaient la saisie du participant.
 */
import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import { createParticipantUser, findParticipantForAuth } from "./participantUser";

export type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Valeurs de création fournies par la requête (PATCH /me, inscription front…). */
export type ParticipantSeed = {
  prenom?: string;
  nom?: string;
  ville?: string;
  arrondissement?: string | null;
  telephone?: string | null;
  age?: number | null;
  sexe?: string | null;
};

function metaString(
  meta: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Renvoie le profil participant du JWT, en le créant si nécessaire.
 * `null` uniquement si le compte Auth n'a pas d'e-mail (création impossible).
 */
export async function ensureParticipantUser(
  authUser: AuthUserLike,
  seed: ParticipantSeed = {},
): Promise<User | null> {
  const existing = await findParticipantForAuth({
    id: authUser.id,
    email: authUser.email ?? undefined,
  });
  if (existing) return existing;

  const email = authUser.email?.trim().toLowerCase();
  if (!email) return null;

  const meta = authUser.user_metadata ?? {};
  const localPart = email.split("@")[0] || "Participant";

  try {
    return await createParticipantUser({
      supabaseId: authUser.id,
      email,
      prenom: seed.prenom ?? metaString(meta, "prenom") ?? localPart,
      nom: seed.nom ?? metaString(meta, "nom") ?? "Participant",
      ville: seed.ville ?? metaString(meta, "ville") ?? "Non renseigné",
      arrondissement:
        seed.arrondissement ?? metaString(meta, "arrondissement"),
      telephone: seed.telephone ?? metaString(meta, "telephone"),
      age: seed.age ?? null,
      sexe: seed.sexe ?? null,
    });
  } catch (err) {
    // Course éventuelle : un autre appel a créé le profil entre-temps.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const again = await findParticipantForAuth({ id: authUser.id, email });
      if (again) return again;
    }
    throw err;
  }
}
