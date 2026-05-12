import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { broadcast } from "../../events/sse";

const router = Router();

// Participant: lire les sondages
router.get("/", requireAuth, async (req, res) => {
  const actifOnly = String(req.query.actif ?? "true").toLowerCase() !== "false";

  const sondages = await prisma.sondage.findMany({
    where: actifOnly ? { actif: true } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      question: true,
      options: true,
      actif: true,
      createdAt: true,
    },
  });

  return res.json(
    sondages.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    })),
  );
});

// Participant: répondre à un sondage
router.post("/:id/reponse", requireAuth, async (req, res) => {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(422).json({
      message: "Body invalide. Attendu: { option: string }",
      error: "INVALID_BODY",
    });
  }

  const { option } = req.body as { option?: unknown };
  if (typeof option !== "string" || !option.trim()) {
    return res.status(422).json({
      message: "Champ requis: option (string).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  const sondageId = String((req.params as any).id);
  const sondage = await prisma.sondage.findUnique({
    where: { id: sondageId },
    select: { id: true, options: true, actif: true },
  });
  if (!sondage) {
    return res.status(404).json({ message: "Sondage introuvable.", error: "NOT_FOUND" });
  }

  const normalized = option.trim();
  const allowed = sondage.options.includes(normalized);
  if (!allowed) {
    return res.status(400).json({
      message: "Option invalide pour ce sondage.",
      error: "INVALID_OPTION",
      options: sondage.options,
    });
  }

  const supabaseUser = (req as any).supabaseUser as { id: string };
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    select: { id: true },
  });
  if (!user) {
    return res.status(404).json({
      message:
        "Aucun profil métier pour ce JWT : complète l’inscription via POST /inscription/.",
      error: "USER_ROW_NOT_FOUND_FOR_JWT",
    });
  }

  try {
    await prisma.sondageReponse.upsert({
      where: { sondageId_userId: { sondageId: sondage.id, userId: user.id } },
      update: { option: normalized },
      create: { sondageId: sondage.id, userId: user.id, option: normalized },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(err);
    } else {
      console.error(err);
    }
    return res.status(500).json({ message: "Impossible d'enregistrer la réponse.", error: "PRISMA_UPSERT_FAILED" });
  }

  broadcast(
    { type: "sondage.updated", data: { reason: "response submitted" } },
    { scope: "admin" },
  );

  return res.status(204).send();
});

export default router;

