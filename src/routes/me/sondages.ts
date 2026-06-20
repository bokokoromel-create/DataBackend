import { Router } from "express";
import { Prisma } from "@prisma/client";
import { recordConsultationCompletee } from "../../lib/gamification";
import { prisma } from "../../lib/prisma";
import {
  PARTICIPANT_NOT_FOUND_RESPONSE,
  resolveParticipantIdFromRequest,
} from "../../lib/participantUser";
import { requireAuth } from "../../middleware/auth";
import { broadcast } from "../../events/sse";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const actifOnly = String(req.query.actif ?? "true").toLowerCase() !== "false";
  const typeFilter =
    typeof req.query.type === "string" && req.query.type.trim()
      ? req.query.type.trim()
      : undefined;

  const sondages = await prisma.sondage.findMany({
    where: {
      ...(actifOnly ? { actif: true } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      question: true,
      options: true,
      type: true,
      actif: true,
      createdAt: true,
    },
  });

  return res.json(
    sondages.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  );
});

router.post("/:id/reponse", requireAuth, async (req, res) => {
  if (
    req.body == null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
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

  const sondageId = String(req.params.id);
  const sondage = await prisma.sondage.findUnique({
    where: { id: sondageId },
    select: { id: true, options: true, actif: true, type: true },
  });
  if (!sondage) {
    return res
      .status(404)
      .json({ message: "Sondage introuvable.", error: "NOT_FOUND" });
  }

  const normalized = option.trim();
  if (!sondage.options.includes(normalized)) {
    return res.status(400).json({
      message: "Option invalide pour ce sondage.",
      error: "INVALID_OPTION",
      options: sondage.options,
    });
  }

  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  try {
    await prisma.sondageReponse.upsert({
      where: { sondageId_userId: { sondageId: sondage.id, userId } },
      update: { option: normalized },
      create: { sondageId: sondage.id, userId, option: normalized },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[sondages] PrismaKnown:", err.code, err.message);
    } else {
      console.error("[sondages] unknown error:", err);
    }
    return res.status(500).json({
      message: "Impossible d'enregistrer la réponse.",
      error: "PRISMA_UPSERT_FAILED",
    });
  }

  if (sondage.type === "consultation") {
    await recordConsultationCompletee(userId);
  }

  broadcast(
    { type: "sondage.updated", data: { reason: "response submitted" } },
    { scope: "admin" },
  );

  return res.status(204).send();
});

export default router;
