import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { evenementFilterFromQuery } from "../../lib/evenementFilters";
import { requireAuth } from "../../middleware/auth";

const router = Router();

function mapEvenement(e: {
  id: string;
  titre: string;
  debutAt: Date;
  lieu: string | null;
  description: string | null;
  imageUrl: string | null;
  categorie: string | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    titre: e.titre,
    description: e.description,
    lieu: e.lieu,
    debutAt: e.debutAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    imageUrl: e.imageUrl,
    ...(e.categorie ? { categorie: e.categorie } : {}),
  };
}

router.get("/", requireAuth, async (req, res) => {
  const { filter, error } = evenementFilterFromQuery(req.query);
  if (error) {
    return res.status(422).json({ message: error, error: "INVALID_QUERY" });
  }

  const evenements = await prisma.evenement.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      titre: true,
      debutAt: true,
      lieu: true,
      description: true,
      imageUrl: true,
      categorie: true,
      createdAt: true,
    },
  });

  return res.json(evenements.map(mapEvenement));
});

export default router;
