import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  createParticipantUser,
  findParticipantForAuth,
} from "../lib/participantUser";
import {
  ensureParticipantUser,
  type ParticipantSeed,
} from "../lib/participantProvision";
import { parseProfilPatch } from "../lib/profilPatch";
import { parseProfilProvision } from "../lib/profilProvision";
import { questionnaireEstComplet } from "../lib/questionnaireFields";
import { resolveZoneAdministrativeId } from "../lib/zoneAdministrative";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

type SupabaseUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Le corps du PATCH sert aussi de valeurs initiales si le profil doit être créé. */
function seedDepuisPatch(data: Prisma.UserUpdateInput): ParticipantSeed {
  const texte = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  return {
    prenom: texte(data.prenom),
    nom: texte(data.nom),
    ville: texte(data.ville),
    arrondissement: texte(data.arrondissement) ?? null,
    telephone: texte(data.telephone) ?? null,
    age: typeof data.age === "number" ? data.age : null,
    sexe: texte(data.sexe) ?? null,
  };
}

async function loadUser(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    include: {
      questionnaire: true,
      diplome: { select: { id: true } },
    },
  });
}

async function loadUserWithLink(authUser: SupabaseUser) {
  const linked = await findParticipantForAuth(authUser);
  if (!linked) return null;
  return loadUser(linked.supabaseId);
}

function toProfilResponse(
  user: NonNullable<Awaited<ReturnType<typeof loadUser>>>,
  supabaseUser: SupabaseUser,
) {
  // `supabaseId` n'est pas exposé au front (vie privée + sécurité).
  const { questionnaire, diplome, createdAt, supabaseId: _supabaseId, ...profil } =
    user;
  void _supabaseId;

  const compteAuthentifie = Boolean(supabaseUser.email_confirmed_at);
  const profilCertifie = questionnaireEstComplet(questionnaire?.reponses ?? null);

  return {
    ...profil,
    createdAt: createdAt.toISOString(),
    compteAuthentifie,
    emailVerifie: compteAuthentifie,
    profilCertifie,
    questionnaireCertifie: profilCertifie,
    diplomeVerifie: Boolean(diplome),
    questionnaire: questionnaire
      ? {
          reponses: questionnaire.reponses,
          soumisAt: questionnaire.createdAt.toISOString(),
        }
      : null,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const supabaseUser = (req as { supabaseUser?: SupabaseUser }).supabaseUser;
  if (!supabaseUser) {
    return res.status(500).json({
      message: "Session invalide.",
      error: "MISSING_SESSION",
    });
  }

  const user = await loadUserWithLink(supabaseUser);
  if (!user) {
    return res.status(404).json({
      message:
        "Compte Auth sans profil métier. Complète l’inscription (POST /inscription/) ou POST /me/provision avec ton JWT.",
      error: "USER_ROW_NOT_FOUND_FOR_JWT",
    });
  }

  return res.json(toProfilResponse(user, supabaseUser));
});

/** Crée le profil métier pour un JWT Auth valide (après inscription Supabase côté front). */
router.post("/provision", requireAuth, async (req, res) => {
  const supabaseUser = (req as { supabaseUser?: SupabaseUser }).supabaseUser;
  if (!supabaseUser?.email) {
    return res.status(500).json({
      message: "Session Auth invalide (e-mail absent).",
      error: "MISSING_SESSION",
    });
  }

  const existing = await findParticipantForAuth(supabaseUser);
  if (existing) {
    return res.status(409).json({
      message: "Profil déjà enregistré. Utilise GET /me/.",
      error: "PROFILE_ALREADY_EXISTS",
    });
  }

  const parsed = parseProfilProvision(req.body);
  if (!parsed.ok) {
    const status = parsed.error === "VALIDATION_SEXE" ? 400 : 422;
    return res.status(status).json({
      message: parsed.message,
      ...(status === 422 ? { error: parsed.error } : {}),
    });
  }

  const user = await createParticipantUser({
    supabaseId: supabaseUser.id,
    email: supabaseUser.email.trim().toLowerCase(),
    ...parsed.data,
  });

  const full = await loadUser(user.supabaseId);
  if (!full) {
    return res.status(500).json({
      message: "Profil créé mais rechargement impossible.",
      error: "PRISMA_CREATE",
    });
  }

  return res.status(201).json(toProfilResponse(full, supabaseUser));
});

router.patch("/", requireAuth, async (req, res) => {
  const supabaseUser = (req as { supabaseUser?: SupabaseUser }).supabaseUser;
  if (!supabaseUser) {
    return res.status(500).json({
      message: "Session invalide.",
      error: "MISSING_SESSION",
    });
  }

  const parsed = parseProfilPatch(req.body);
  if (!parsed.ok) {
    return res.status(parsed.status ?? 422).json({
      message: parsed.message,
      error: parsed.error,
    });
  }

  /* Profil absent : on le crée à partir du PATCH plutôt que de renvoyer 404
     et de perdre la saisie du participant (MAJ-2026-08-23). */
  let existing;
  try {
    existing = await ensureParticipantUser(supabaseUser, seedDepuisPatch(parsed.data));
  } catch (err) {
    console.error("[profil] ensureParticipantUser:", err);
    return res.status(500).json({
      message: "Impossible de créer le profil participant pour ce compte.",
      error: "PRISMA_USER_CREATE_FAILED",
    });
  }

  if (!existing) {
    return res.status(400).json({
      message:
        "Compte Auth sans e-mail : impossible de créer le profil. Reconnecte-toi ou complète l’inscription.",
      error: "AUTH_EMAIL_MISSING",
    });
  }

  /* Recalcule la zone administrative si ville/arrondissement changent, ou pour
     backfiller les profils créés avant l'introduction de ZoneAdministrative. */
  let zoneAdministrativeId: string | null | undefined;
  if (
    "ville" in parsed.data ||
    "arrondissement" in parsed.data ||
    !existing.zoneAdministrativeId
  ) {
    const villeFinale =
      typeof parsed.data.ville === "string" ? parsed.data.ville : existing.ville;
    const arrondissementFinal =
      "arrondissement" in parsed.data
        ? (parsed.data.arrondissement as string | null)
        : existing.arrondissement;
    zoneAdministrativeId = await resolveZoneAdministrativeId(
      villeFinale,
      arrondissementFinal,
    );
  }

  const dataMiseAJour: Prisma.UserUncheckedUpdateInput = {
    ...parsed.data,
    ...(zoneAdministrativeId !== undefined ? { zoneAdministrativeId } : {}),
  };

  await prisma.user.update({
    where: { id: existing.id },
    data: dataMiseAJour,
  });

  const user = await loadUser(existing.supabaseId);
  if (!user) {
    return res.status(500).json({
      message: "Profil introuvable après mise à jour.",
      error: "PRISMA_UPDATE",
    });
  }

  return res.json(toProfilResponse(user, supabaseUser));
});

export default router;
