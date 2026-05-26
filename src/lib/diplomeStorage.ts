import { readEnv } from "./envRead";
import { supabase } from "./supabase";

export const DIPLOME_MAX_BYTES_DEFAULT = 4 * 1024 * 1024;

export const DIPLOME_MIME_ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function diplomeBucket(): string {
  return readEnv("SUPABASE_DIPLOMES_BUCKET") || "diplomes";
}

export function diplomeSignedUrlSeconds(): number {
  const raw = readEnv("DIPLOME_SIGNED_URL_SECONDS");
  const n = raw ? Number.parseInt(raw, 10) : 300;
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export function diplomeMaxBytes(): number {
  const raw = readEnv("DIPLOME_MAX_BYTES");
  const n = raw ? Number.parseInt(raw, 10) : DIPLOME_MAX_BYTES_DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : DIPLOME_MAX_BYTES_DEFAULT;
}

/** Chemin objet Storage : `{userId}/{diplomeId}.{ext}` */
export function storagePathFor(
  userId: string,
  diplomeId: string,
  fileName: string,
): string {
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : "";
  return `${userId}/${diplomeId}${ext}`;
}

export async function uploadDiplomeFile(
  storagePath: string,
  body: Buffer,
  mimeType: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(diplomeBucket())
    .upload(storagePath, body, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function removeDiplomeFile(
  storagePath: string,
): Promise<void> {
  await supabase.storage.from(diplomeBucket()).remove([storagePath]);
}

export async function createDiplomeDownloadUrl(
  storagePath: string,
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(diplomeBucket())
    .createSignedUrl(storagePath, diplomeSignedUrlSeconds());

  if (error || !data?.signedUrl) {
    return {
      url: null,
      error: error?.message ?? "URL signée indisponible.",
    };
  }
  return { url: data.signedUrl, error: null };
}
