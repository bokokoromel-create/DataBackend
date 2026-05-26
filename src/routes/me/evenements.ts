import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";

const router = Router();

// Participant: lire les événements
router.get("/", requireAuth, async (_req, res) => {
  const evenements = await prisma.evenement.findMany({
    orderBy: { debutAt: "desc" },
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

export default router;

