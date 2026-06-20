import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  parseEvenementCategorie,
  validateEvenementCategorie,
} from "../../lib/evenementCategories";
import {
  evenementImagePath,
  removeEvenementImageByUrl,
  uploadEvenementImage,
} from "../../lib/evenementStorage";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { evenementUploadOptional } from "../../middleware/evenementUpload";
import { broadcast } from "../../events/sse";

const router = Router();

const evenementSelect = {
  id: true,
  titre: true,
  debutAt: true,
  lieu: true,
  description: true,
  imageUrl: true,
  categorie: true,
  createdAt: true,
} as const;

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

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const evenements = await prisma.evenement.findMany({
    orderBy: { createdAt: "desc" },
    select: evenementSelect,
  });
  return res.json(evenements.map(mapEvenement));
});

router.post(
  "/",
  requireAuth,
  requireAdmin,
  evenementUploadOptional,
  async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const titre = typeof body.titre === "string" ? body.titre.trim() : "";
    const debutAtRaw =
      typeof body.debutAt === "string" ? body.debutAt.trim() : "";

    if (!titre || !debutAtRaw) {
      return res.status(422).json({
        message: "Champs requis: titre (string) et debutAt (ISO string).",
        error: "VALIDATION_MISSING_FIELDS",
      });
    }

    const date = new Date(debutAtRaw);
    if (Number.isNaN(date.getTime())) {
      return res.status(422).json({
        message: "debutAt invalide (attendu ISO).",
        error: "INVALID_DATE",
      });
    }

    const catErr = validateEvenementCategorie(body.categorie);
    if (catErr) {
      return res.status(422).json({ message: catErr, error: "INVALID_CATEGORIE" });
    }

    const categorie = parseEvenementCategorie(body.categorie);
    const lieu =
      typeof body.lieu === "string" && body.lieu.trim() ? body.lieu.trim() : null;
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    let evt = await prisma.evenement.create({
      data: {
        titre,
        debutAt: date,
        lieu,
        description,
        categorie,
      },
      select: evenementSelect,
    });

    if (req.file) {
      const storagePath = evenementImagePath(evt.id, req.file.originalname);
      const uploaded = await uploadEvenementImage(
        storagePath,
        req.file.buffer,
        req.file.mimetype,
      );

      if (uploaded.error || !uploaded.publicUrl) {
        await prisma.evenement.delete({ where: { id: evt.id } }).catch(() => {});
        return res.status(502).json({
          message: uploaded.error ?? "Upload Storage échoué.",
          error: "STORAGE_UPLOAD_FAILED",
        });
      }

      evt = await prisma.evenement.update({
        where: { id: evt.id },
        data: { imageUrl: uploaded.publicUrl },
        select: evenementSelect,
      });
    }

    broadcast({ type: "evenement.updated", data: { reason: "created" } }, { scope: "admin" });
    return res.status(201).json(mapEvenement(evt));
  },
);

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);

  const existing = await prisma.evenement.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  if (!existing) {
    return res.status(404).json({
      message: "Événement introuvable.",
      error: "NOT_FOUND",
    });
  }

  await removeEvenementImageByUrl(existing.imageUrl);
  await prisma.evenement.delete({ where: { id } });

  broadcast({ type: "evenement.updated", data: { reason: "deleted" } }, { scope: "admin" });
  return res.status(204).send();
});

export default router;
