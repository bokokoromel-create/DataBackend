/**
 * Questionnaire participant.
 *
 * - Persiste les réponses dans PostgreSQL (`Questionnaire`, via Prisma).
 * - Réplique sur le compte **Supabase Auth** du participant : `user_metadata` (dashboard Auth,
 *   client `getSession`, etc.). En cas d’échec de cette synchro, la transaction Prisma est
 *   annulée (retour à l’état précédent) pour éviter un décalage.
 *
 * Attention : `user_metadata` est limité en taille (~quelques Ko côté JWT) ; un JSON très gros
 * peut faire échouer la synchro → `SUPABASE_USER_METADATA_SYNC_FAILED` après rollback Prisma.
 */
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { questionnaireInvalidBody } from "../lib/exampleCurls";
import { supabase } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import type { ProfilReponses } from "../types/front-contract";
import { broadcast } from "../events/sse";

const router = Router();

async function rollbackQuestionnaire(
  userId: string,
  before: { reponses: Prisma.JsonValue } | null,
) {
  if (before) {
    await prisma.questionnaire.update({
      where: { userId },
      data: { reponses: before.reponses as Prisma.InputJsonValue },
    });
  } else {
    await prisma.questionnaire.delete({ where: { userId } }).catch(() => {
      /* ligne déjà absente */
    });
  }
}

router.post("/", requireAuth, async (req, res) => {
  if (
    req.body == null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json(questionnaireInvalidBody());
  }

  const supabaseUser = (req as any).supabaseUser;
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });
  if (!user) {
    return res.status(404).json({
      message:
        "Aucun profil métier pour ce compte : inscris-toi via POST /inscription/ avec le même e-mail.",
      error: "USER_ROW_NOT_FOUND_FOR_JWT",
    });
  }

  const reponses = req.body as ProfilReponses;

  const before = await prisma.questionnaire.findUnique({
    where: { userId: user.id },
  });

  let questionnaire;
  try {
    questionnaire = await prisma.questionnaire.upsert({
      where: { userId: user.id },
      update: { reponses: reponses as Prisma.InputJsonValue },
      create: {
        userId: user.id,
        reponses: reponses as Prisma.InputJsonValue,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({
      message: "Enregistrement du questionnaire en base impossible.",
      error: "PRISMA_UPSERT_FAILED",
    });
  }

  const { data: authSnap, error: fetchErr } =
    await supabase.auth.admin.getUserById(supabaseUser.id);

  if (fetchErr || !authSnap.user) {
    await rollbackQuestionnaire(user.id, before);
    return res.status(502).json({
      message:
        "Impossible de lire le compte Supabase pour synchroniser les métadonnées.",
      error: "SUPABASE_AUTH_FETCH_FAILED",
      detail: fetchErr?.message,
    });
  }

  const prevMeta =
    (authSnap.user.user_metadata as Record<string, unknown> | null) ?? {};
  const mergedUserMetadata = {
    ...prevMeta,
    questionnaireReponses: reponses as Prisma.InputJsonValue,
    questionnaireUpdatedAt: new Date().toISOString(),
    questionnairePrismaId: questionnaire.id,
  };

  const { error: metaErr } = await supabase.auth.admin.updateUserById(
    supabaseUser.id,
    { user_metadata: mergedUserMetadata },
  );

  if (metaErr) {
    await rollbackQuestionnaire(user.id, before);
    return res.status(502).json({
      message:
        "Échec de la mise à jour Supabase Auth (user_metadata). Données PostgreSQL restaurées à l’état précédent. Vérifie la taille du JSON ou les politiques du projet.",
      error: "SUPABASE_USER_METADATA_SYNC_FAILED",
      detail: metaErr.message,
    });
  }

  broadcast(
    {
      type: "participant.questionnaire.updated",
      data: { reason: "questionnaire upserted" },
    },
    { scope: "admin" },
  );
  return res.status(201).json(questionnaire);
});

export default router;
