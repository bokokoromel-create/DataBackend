import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../lib/prisma";
import {
  PARTICIPANT_NOT_FOUND_RESPONSE,
  resolveParticipantIdFromRequest,
} from "../../lib/participantUser";
import { requireAuth } from "../../middleware/auth";
import { diplomeUpload } from "../../middleware/diplomeUpload";
import {
  createDiplomeDownloadUrl,
  diplomeMaxBytes,
  DIPLOME_MIME_ALLOWED,
  removeDiplomeFile,
  storagePathFor,
  uploadDiplomeFile,
} from "../../lib/diplomeStorage";

const router = Router();

type AuthedRequest = Request & { supabaseUser: { id: string } };

function multerErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return `Fichier trop volumineux (max ${Math.round(diplomeMaxBytes() / (1024 * 1024))} Mo).`;
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Erreur lors de l’upload.";
}

async function serializeOwnDiplome(diplome: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  storagePath: string;
}) {
  const { url, error } = await createDiplomeDownloadUrl(diplome.storagePath);
  return {
    id: diplome.id,
    fileName: diplome.fileName,
    mimeType: diplome.mimeType,
    sizeBytes: diplome.sizeBytes,
    uploadedAt: diplome.uploadedAt.toISOString(),
    downloadUrl: url,
    ...(error ? { downloadUrlError: error } : {}),
  };
}

async function handleUpload(req: AuthedRequest, res: Response) {
  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  const file = req.file;
  if (!file?.buffer?.length) {
    return res.status(422).json({
      message: "Fichier requis (multipart, champ « file »).",
      error: "MISSING_FILE",
    });
  }

  if (!DIPLOME_MIME_ALLOWED.has(file.mimetype)) {
    return res.status(422).json({
      message: "Type MIME non autorisé.",
      error: "INVALID_MIME",
      allowed: [...DIPLOME_MIME_ALLOWED],
    });
  }

  if (file.size > diplomeMaxBytes()) {
    return res.status(422).json({
      message: `Fichier trop volumineux (max ${diplomeMaxBytes()} octets).`,
      error: "FILE_TOO_LARGE",
    });
  }

  const existing = await prisma.diplome.findUnique({ where: { userId } });
  const fileName = file.originalname || "diplome";
  const diplomeId = existing?.id ?? randomUUID();
  const storagePath = storagePathFor(req.supabaseUser.id, diplomeId, fileName);

  const { error: uploadErr } = await uploadDiplomeFile(
    storagePath,
    file.buffer,
    file.mimetype,
  );
  if (uploadErr) {
    return res.status(502).json({
      message: uploadErr,
      error: "STORAGE_UPLOAD_FAILED",
    });
  }

  if (existing && existing.storagePath !== storagePath) {
    await removeDiplomeFile(existing.storagePath);
  }

  const diplome = await prisma.diplome.upsert({
    where: { userId },
    create: {
      id: diplomeId,
      userId,
      fileName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath,
    },
    update: {
      fileName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath,
      uploadedAt: new Date(),
    },
  });

  const body = await serializeOwnDiplome(diplome);
  return res.status(existing ? 200 : 201).json(body);
}

router.get("/", requireAuth, async (req, res) => {
  const userId = await resolveParticipantIdFromRequest(req);
  if (!userId) {
    const r = PARTICIPANT_NOT_FOUND_RESPONSE;
    return res.status(r.status).json(r.body);
  }

  const diplome = await prisma.diplome.findUnique({ where: { userId } });
  if (!diplome) {
    return res.status(404).json({
      message: "Aucun diplôme enregistré.",
      error: "DIPLOME_NOT_FOUND",
    });
  }

  return res.json(await serializeOwnDiplome(diplome));
});

const uploadMiddleware = diplomeUpload.single("file");

function runUpload(req: Request, res: Response, next: NextFunction) {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      res.status(422).json({
        message: multerErrorMessage(err),
        error: "UPLOAD_REJECTED",
      });
      return;
    }
    next();
  });
}

router.post("/", requireAuth, runUpload, (req, res) =>
  handleUpload(req as AuthedRequest, res),
);
router.put("/", requireAuth, runUpload, (req, res) =>
  handleUpload(req as AuthedRequest, res),
);

export default router;
