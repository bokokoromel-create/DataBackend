import { randomUUID } from "crypto";
import { readEnv } from "./envRead";
import { supabase } from "./supabase";

export const EVENEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const EVENEMENT_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function evenementBucket(): string {
  return readEnv("SUPABASE_EVENEMENTS_BUCKET") || "evenements";
}

/** Chemin objet dans le bucket : `{evenementId}/{uuid}.{ext}` */
export function evenementImagePath(eventId: string, fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : ".jpg";
  return `${eventId}/${randomUUID()}${ext}`;
}

export async function ensureEvenementBucket(): Promise<{ error: string | null }> {
  const bucket = evenementBucket();
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) return { error: listErr.message };
  if (buckets?.some((b) => b.name === bucket)) return { error: null };

  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: EVENEMENT_IMAGE_MAX_BYTES,
    allowedMimeTypes: [...EVENEMENT_IMAGE_MIME],
  });
  if (error && !/already exists/i.test(error.message)) {
    return { error: error.message };
  }
  return { error: null };
}

export async function uploadEvenementImage(
  storagePath: string,
  body: Buffer,
  mimeType: string,
): Promise<{ publicUrl: string | null; storagePath: string; error: string | null }> {
  const bucketErr = await ensureEvenementBucket();
  if (bucketErr.error) {
    return { publicUrl: null, storagePath, error: bucketErr.error };
  }

  const bucket = evenementBucket();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    return { publicUrl: null, storagePath, error: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath, error: null };
}

/** Extrait le chemin objet depuis une URL publique Supabase Storage. */
export function storagePathFromPublicUrl(imageUrl: string): string | null {
  const bucket = evenementBucket();
  const marker = `/object/public/${bucket}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(imageUrl.slice(idx + marker.length));
  } catch {
    return imageUrl.slice(idx + marker.length);
  }
}

export async function removeEvenementImage(storagePath: string): Promise<void> {
  await supabase.storage.from(evenementBucket()).remove([storagePath]);
}

export async function removeEvenementImageByUrl(imageUrl: string | null): Promise<void> {
  if (!imageUrl) return;
  const path = storagePathFromPublicUrl(imageUrl);
  if (path) await removeEvenementImage(path);
}
