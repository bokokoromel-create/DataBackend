import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const supabaseUser = (req as any).supabaseUser;
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
  return res.json(user);
});

export default router;
