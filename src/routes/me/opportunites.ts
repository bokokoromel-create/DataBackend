import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";

const router = Router();

function mapOpportunite(o: {
  id: string;
  type: string;
  titre: string;
  description: string | null;
  ville: string | null;
  echeanceAt: Date | null;
  lien: string | null;
  imageUrl: string | null;
  createdAt: Date;
}) {
  return {
    ...o,
    echeanceAt: o.echeanceAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

router.get("/", requireAuth, async (_req, res) => {
  const rows = await prisma.opportunite.findMany({
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows.map(mapOpportunite));
});

export default router;
