import type { Request } from "express";
import type { User } from "@prisma/client";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { prisma } from "./prisma";
import { resolveZoneAdministrativeId } from "./zoneAdministrative";

export type ParticipantCreateInput = {
  supabaseId: string;
  prenom: string;
  nom: string;
  email: string;
  ville: string;
  arrondissement?: string | null;
  telephone?: string | null;
  age?: number | null;
  sexe?: string | null;
};

/** Cherche le participant par supabaseId, sinon par e-mail (re-lie le compte Auth). */
export async function findParticipantForAuth(
  authUser: Pick<SupabaseAuthUser, "id" | "email">,
): Promise<User | null> {
  const bySupabase = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
  });
  if (bySupabase) return bySupabase;

  const email = authUser.email?.trim().toLowerCase();
  if (!email) return null;

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (!byEmail) return null;

  if (byEmail.supabaseId !== authUser.id) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { supabaseId: authUser.id },
    });
  }

  return byEmail;
}

export async function createParticipantUser(
  data: ParticipantCreateInput,
): Promise<User> {
  const zoneAdministrativeId = await resolveZoneAdministrativeId(
    data.ville,
    data.arrondissement,
  );
  return prisma.user.create({ data: { ...data, zoneAdministrativeId } });
}

export function isAuthEmailAlreadyRegistered(message: string): boolean {
  return /already (been )?registered|already exists|duplicate|user already/i.test(
    message,
  );
}

/**
 * Helper utilisé par toutes les routes `/me/*` après `requireAuth` :
 * renvoie l'`id` Prisma du participant ou `null` si la ligne n'existe pas encore.
 */
export async function resolveParticipantIdFromRequest(
  req: Request,
): Promise<string | null> {
  const supabaseUser = (req as Request & { supabaseUser?: { id: string } })
    .supabaseUser;
  if (!supabaseUser) return null;
  const row = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    select: { id: true },
  });
  return row?.id ?? null;
}

export const PARTICIPANT_NOT_FOUND_RESPONSE = {
  status: 404 as const,
  body: {
    message:
      "Aucun profil métier pour ce JWT : complète l’inscription via POST /inscription/ ou POST /me/provision.",
    error: "USER_ROW_NOT_FOUND_FOR_JWT" as const,
  },
};
