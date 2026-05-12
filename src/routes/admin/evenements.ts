import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { broadcast } from "../../events/sse";

const router = Router();

// Admin: lister les événements
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const evenements = await prisma.evenement.findMany({
    orderBy: { debutAt: "asc" },
    select: {
      id: true,
      titre: true,
      debutAt: true,
      lieu: true,
      description: true,
      createdAt: true,
    },
  });

  return res.json(
    evenements.map((e) => ({
      ...e,
      debutAt: e.debutAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
  );
});

// Admin: créer un événement
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(422).json({
      message:
        "Body invalide. Attendu: { titre: string, debutAt: ISO string, lieu?: string, description?: string }",
      error: "INVALID_BODY",
    });
  }

  const { titre, debutAt, lieu, description } = req.body as Record<string, unknown>;

  if (typeof titre !== "string" || !titre.trim() || typeof debutAt !== "string" || !debutAt.trim()) {
    return res.status(422).json({
      message: "Champs requis: titre (string) et debutAt (ISO string).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  const date = new Date(debutAt);
  if (Number.isNaN(date.getTime())) {
    return res.status(422).json({
      message: "debutAt invalide (attendu ISO).",
      error: "INVALID_DATE",
    });
  }

  const evt = await prisma.evenement.create({
    data: {
      titre: titre.trim(),
      debutAt: date,
      lieu: typeof lieu === "string" && lieu.trim() ? lieu.trim() : null,
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
    },
    select: {
      id: true,
      titre: true,
      debutAt: true,
      lieu: true,
      description: true,
      createdAt: true,
    },
  });

  broadcast({ type: "evenement.updated", data: { reason: "created" } }, { scope: "admin" });

  return res.status(201).json({
    ...evt,
    debutAt: evt.debutAt.toISOString(),
    createdAt: evt.createdAt.toISOString(),
  });
});

// Admin: supprimer un événement
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String((req.params as any).id);
  await prisma.evenement.delete({ where: { id } }).catch(() => null);
  broadcast({ type: "evenement.updated", data: { reason: "deleted" } }, { scope: "admin" });
  return res.status(204).send();
});

export default router;

