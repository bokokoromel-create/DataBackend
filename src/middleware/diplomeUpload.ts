import multer from "multer";
import {
  DIPLOME_MIME_ALLOWED,
  diplomeMaxBytes,
} from "../lib/diplomeStorage";

export const diplomeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: diplomeMaxBytes() },
  fileFilter: (_req, file, cb) => {
    if (!DIPLOME_MIME_ALLOWED.has(file.mimetype)) {
      cb(
        new Error(
          "Type de fichier non autorisé. Formats acceptés : PDF, JPEG, PNG, WebP.",
        ),
      );
      return;
    }
    cb(null, true);
  },
});
