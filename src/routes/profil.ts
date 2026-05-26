import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const supabaseUser = (req as { supabaseUser?: { id: string } }).supabaseUser;
  if (!supabaseUser) {
    return res.status(500).json({
      message: "Session invalide.",
      error: "MISSING_SESSION",
    });
  }
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: { questionnaire: true },
  });
  if (!user) {
    return res.status(404).json({
      message:
        "Aucun profil métier pour ce JWT : complète l’inscription via POST /inscription/.",
      error: "USER_ROW_NOT_FOUND_FOR_JWT",
    });
  }

  const { questionnaire, createdAt, supabaseId: _ignored, ...profil } = user;
  void _ignored;

  return res.json({
    ...profil,
    createdAt: createdAt.toISOString(),
    questionnaire: questionnaire
      ? {
          reponses: questionnaire.reponses,
          soumisAt: questionnaire.createdAt.toISOString(),
        }
      : null,
  });
});

export default router;
