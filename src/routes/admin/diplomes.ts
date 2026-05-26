import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { createDiplomeDownloadUrl } from "../../lib/diplomeStorage";

const router = Router();

async function withDownloadUrl(diplome: {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  uploadedAt: Date;
  storagePath: string;
  user: { email: string; nom: string; prenom: string };
}) {
  const { url, error } = await createDiplomeDownloadUrl(diplome.storagePath);
  return {
    id: diplome.id,
    participantId: diplome.userId,
    email: diplome.user.email,
    nom: diplome.user.nom,
    prenom: diplome.user.prenom,
    fileName: diplome.fileName,
    mimeType: diplome.mimeType,
    uploadedAt: diplome.uploadedAt.toISOString(),
    downloadUrl: url,
    ...(error ? { downloadUrlError: error } : {}),
  };
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const diplomes = await prisma.diplome.findMany({
    orderBy: { uploadedAt: "desc" },
    include: {
      user: { select: { email: true, nom: true, prenom: true } },
    },
  });

  const items = await Promise.all(diplomes.map(withDownloadUrl));
  return res.json(items);
});

router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const diplome = await prisma.diplome.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, nom: true, prenom: true } },
    },
  });

  if (!diplome) {
    return res.status(404).json({
      message: "Diplôme introuvable.",
      error: "NOT_FOUND",
    });
  }

  return res.json(await withDownloadUrl(diplome));
});

export default router;
