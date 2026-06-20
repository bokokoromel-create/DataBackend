import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  PARTICIPANT_NOT_FOUND_RESPONSE,
  resolveParticipantIdFromRequest,
} from "../../lib/participantUser";
import { requireAuth } from "../../middleware/auth";

const router = Router();

const REACTION_TYPES = new Set(["utile", "interessant", "a_suivre"] as const);

async function publicationExists(id: string): Promise<boolean> {
  const pub = await prisma.evenement.findUnique({
    where: { id },
    select: { id: true },
  });
  return Boolean(pub);
}

router.get("/:id/reactions", requireAuth, async (req, res) => {
  const publicationId = String(req.params.id);
  if (!(await publicationExists(publicationId))) {
    return res
      .status(404)
      .json({ message: "Publication introuvable.", error: "NOT_FOUND" });
  }

  const userId = await resolveParticipantIdFromRequest(req);
  const reactions = await prisma.publicationReaction.findMany({
    where: { publicationId },
    select: { type: true, userId: true },
  });

  const counts = { utile: 0, interessant: 0, a_suivre: 0 };
  let maReaction: string | null = null;

  for (const r of reactions) {
    if (r.type in counts) {
      counts[r.type as keyof typeof counts] += 1;
    }
    if (userId && r.userId === userId) maReaction = r.type;
  }

  return res.json({ ...counts, maReaction });
});

router.post("/:id/reactions", requireAuth, async (req, res) => {
  const publicationId = String(req.params.id);
  if (!(await publicationExists(publicationId))) {
    return res
      .status(404)
      .json({ message: "Publication introuvable.", error: "NOT_FOUND" });
  }

  const { type } = req.body as { type?: unknown };
  if (typeof type !== "string" || !REACTION_TYPES.has(type as never)) {
    return res.status(422).json({
      message: 'type requis: "utile" | "interessant" | "a_suivre".',
      error: "INVALID_REACTION_TYPE",
    });
  }

  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  await prisma.publicationReaction.upsert({
    where: { publicationId_userId: { publicationId, userId } },
    create: { publicationId, userId, type },
    update: { type },
  });

  return res.status(204).send();
});

router.get("/:id/commentaires", requireAuth, async (req, res) => {
  const publicationId = String(req.params.id);
  if (!(await publicationExists(publicationId))) {
    return res
      .status(404)
      .json({ message: "Publication introuvable.", error: "NOT_FOUND" });
  }

  const rows = await prisma.publicationCommentaire.findMany({
    where: { publicationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      texte: true,
      createdAt: true,
      user: { select: { prenom: true, nom: true } },
    },
  });

  return res.json(
    rows.map((c) => ({
      id: c.id,
      auteurPrenom: c.user.prenom,
      auteurNom: c.user.nom,
      texte: c.texte,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/:id/commentaires", requireAuth, async (req, res) => {
  const publicationId = String(req.params.id);
  if (!(await publicationExists(publicationId))) {
    return res
      .status(404)
      .json({ message: "Publication introuvable.", error: "NOT_FOUND" });
  }

  const { texte } = req.body as { texte?: unknown };
  if (typeof texte !== "string" || !texte.trim()) {
    return res.status(422).json({
      message: "texte requis (string non vide).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  const comment = await prisma.publicationCommentaire.create({
    data: { publicationId, userId, texte: texte.trim() },
    select: {
      id: true,
      texte: true,
      createdAt: true,
      user: { select: { prenom: true, nom: true } },
    },
  });

  return res.status(201).json({
    id: comment.id,
    auteurPrenom: comment.user.prenom,
    auteurNom: comment.user.nom,
    texte: comment.texte,
    createdAt: comment.createdAt.toISOString(),
  });
});

export default router;
