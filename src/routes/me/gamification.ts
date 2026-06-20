import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  PARTICIPANT_NOT_FOUND_RESPONSE,
  resolveParticipantIdFromRequest,
} from "../../lib/participantUser";
import {
  getGamificationPayload,
  recordConsultationCompletee,
  recordPublicationView,
} from "../../lib/gamification";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }
  return res.json(await getGamificationPayload(userId));
});

router.post("/publication-vue", requireAuth, async (req, res) => {
  const { publicationId } = req.body as { publicationId?: unknown };
  if (typeof publicationId !== "string" || !publicationId.trim()) {
    return res.status(422).json({
      message: "publicationId requis (string).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  const exists = await prisma.evenement.findUnique({
    where: { id: publicationId.trim() },
    select: { id: true },
  });
  if (!exists) {
    return res
      .status(404)
      .json({ message: "Publication introuvable.", error: "NOT_FOUND" });
  }

  await recordPublicationView(userId, publicationId.trim());
  return res.status(204).send();
});

router.post("/consultation-completee", requireAuth, async (req, res) => {
  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  await recordConsultationCompletee(userId);
  return res.status(204).send();
});

export default router;
