import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { broadcast } from "../../events/sse";

const router = Router();

// Admin: lister les sondages
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const sondages = await prisma.sondage.findMany({
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
    sondages.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  );
});

// Admin: créer un sondage
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(422).json({
      message:
        "Body invalide. Attendu: { question: string, options: string[], actif?: boolean }",
      error: "INVALID_BODY",
    });
  }

  const { question, options, actif } = req.body as Record<string, unknown>;

  if (typeof question !== "string" || !question.trim()) {
    return res.status(422).json({
      message: "question requis (string).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }
  if (!Array.isArray(options) || options.length < 2 || options.some((o) => typeof o !== "string" || !o.trim())) {
    return res.status(422).json({
      message: "options requis (string[]), min 2 options non vides.",
      error: "INVALID_OPTIONS",
    });
  }

  const uniqueOptions = Array.from(new Set(options.map((o) => String(o).trim()))).filter(Boolean);
  if (uniqueOptions.length < 2) {
    return res.status(422).json({
      message: "options doit contenir au moins 2 valeurs distinctes.",
      error: "INVALID_OPTIONS",
    });
  }

  const sondage = await prisma.sondage.create({
    data: {
      question: question.trim(),
      options: uniqueOptions,
      actif: typeof actif === "boolean" ? actif : true,
    },
    select: {
      id: true,
      question: true,
      options: true,
      actif: true,
      createdAt: true,
    },
  });

  broadcast({ type: "sondage.updated", data: { reason: "created" } }, { scope: "admin" });

  return res.status(201).json({ ...sondage, createdAt: sondage.createdAt.toISOString() });
});

// Admin: supprimer un sondage
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String((req.params as any).id);
  await prisma.sondage.delete({ where: { id } }).catch(() => null);
  broadcast({ type: "sondage.updated", data: { reason: "deleted" } }, { scope: "admin" });
  return res.status(204).send();
});

// Admin: stats réponses
router.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  const sondages = await prisma.sondage.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      question: true,
      options: true,
      reponses: { select: { option: true } },
    },
  });

  const stats = sondages.map((s) => {
    const counts: Record<string, number> = {};
    for (const opt of s.options) counts[opt] = 0;
    for (const r of s.reponses) counts[r.option] = (counts[r.option] ?? 0) + 1;
    return {
      sondageId: s.id,
      question: s.question,
      totalReponses: s.reponses.length,
      options: s.options.map((opt) => ({ option: opt, count: counts[opt] ?? 0 })),
    };
  });

  return res.json(stats);
});

export default router;

