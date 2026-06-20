import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { broadcast } from "../../events/sse";

const router = Router();

const SONDAGE_TYPES = new Set(["rapide", "consultation"]);

function mapSondage(s: {
  id: string;
  question: string;
  options: string[];
  type: string;
  actif: boolean;
  createdAt: Date;
}) {
  return { ...s, createdAt: s.createdAt.toISOString() };
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const sondages = await prisma.sondage.findMany({
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

  return res.json(sondages.map(mapSondage));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(422).json({
      message:
        "Body invalide. Attendu: { question: string, options: string[], type?: rapide|consultation, actif?: boolean }",
      error: "INVALID_BODY",
    });
  }

  const { question, options, actif, type } = req.body as Record<string, unknown>;

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

  const sondageType =
    typeof type === "string" && SONDAGE_TYPES.has(type) ? type : "consultation";

  const sondage = await prisma.sondage.create({
    data: {
      question: question.trim(),
      options: uniqueOptions,
      type: sondageType,
      actif: typeof actif === "boolean" ? actif : true,
    },
    select: {
      id: true,
      question: true,
      options: true,
      type: true,
      actif: true,
      createdAt: true,
    },
  });

  broadcast({ type: "sondage.updated", data: { reason: "created" } }, { scope: "admin" });
  return res.status(201).json(mapSondage(sondage));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  await prisma.sondage.delete({ where: { id } }).catch(() => null);
  broadcast({ type: "sondage.updated", data: { reason: "deleted" } }, { scope: "admin" });
  return res.status(204).send();
});

router.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  const sondages = await prisma.sondage.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      question: true,
      options: true,
      type: true,
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
      type: s.type,
      totalReponses: s.reponses.length,
      options: s.options.map((opt) => ({ option: opt, count: counts[opt] ?? 0 })),
    };
  });

  return res.json(stats);
});

export default router;
