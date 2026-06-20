import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import {
  EVENEMENT_IMAGE_MAX_BYTES,
  EVENEMENT_IMAGE_MIME,
} from "../lib/evenementStorage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVENEMENT_IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (EVENEMENT_IMAGE_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_MEDIA_TYPE"));
    }
  },
});

/** Multipart optionnel : champ `image`. Erreurs fichier → 400 JSON. */
export function evenementUploadOptional(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single("image")(req, res, (err: unknown) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: `Image trop volumineuse (max ${EVENEMENT_IMAGE_MAX_BYTES} octets / 5 Mo).`,
        error: "FILE_TOO_LARGE",
      });
    }

    if (err instanceof Error && err.message === "UNSUPPORTED_MEDIA_TYPE") {
      return res.status(400).json({
        message: "Type MIME non autorisé (jpeg, png, webp, gif).",
        error: "UNSUPPORTED_MEDIA_TYPE",
      });
    }

    return next(err);
  });
}
