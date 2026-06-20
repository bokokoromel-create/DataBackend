import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();

export const OPPORTUNITE_TYPES = [
  "stage",
  "concours",
  "appel_projet",
  "financement",
  "evenement",
  "formation",
  "emploi",
] as const;

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

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await prisma.opportunite.findMany({ orderBy: { createdAt: "desc" } });
  return res.json(rows.map(mapOpportunite));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(422).json({ message: "Body JSON invalide.", error: "INVALID_BODY" });
  }

  const body = req.body as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const titre = typeof body.titre === "string" ? body.titre.trim() : "";

  if (!type || !OPPORTUNITE_TYPES.includes(type as (typeof OPPORTUNITE_TYPES)[number])) {
    return res.status(422).json({
      message: `type requis (${OPPORTUNITE_TYPES.join(", ")}).`,
      error: "INVALID_TYPE",
    });
  }
  if (!titre) {
    return res.status(422).json({
      message: "titre requis (string).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  let echeanceAt: Date | null = null;
  if (typeof body.echeanceAt === "string" && body.echeanceAt.trim()) {
    echeanceAt = new Date(body.echeanceAt);
    if (Number.isNaN(echeanceAt.getTime())) {
      return res.status(422).json({
        message: "echeanceAt invalide (ISO).",
        error: "INVALID_DATE",
      });
    }
  }

  const row = await prisma.opportunite.create({
    data: {
      type,
      titre,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      ville:
        typeof body.ville === "string" && body.ville.trim()
          ? body.ville.trim()
          : null,
      echeanceAt,
      lien:
        typeof body.lien === "string" && body.lien.trim() ? body.lien.trim() : null,
      imageUrl:
        typeof body.imageUrl === "string" && body.imageUrl.trim()
          ? body.imageUrl.trim()
          : null,
    },
  });

  return res.status(201).json(mapOpportunite(row));
});

export default router;
