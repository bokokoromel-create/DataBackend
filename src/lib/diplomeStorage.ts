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

/**
 * Chemin objet Storage : `{supabaseId}/{diplomeId}.{ext}`
 * `supabaseId` = `auth.uid()` côté Supabase (aligné RLS Storage si upload direct).
 */
export function storagePathFor(
  supabaseId: string,
  diplomeId: string,
  fileName: string,
): string {
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : "";
  return `${supabaseId}/${diplomeId}${ext}`;
}

/** Crée le bucket privé s’il n’existe pas (service role). */
export async function ensureDiplomeBucket(): Promise<{ error: string | null }> {
  const bucket = diplomeBucket();
  const { data: existing, error: listErr } =
    await supabase.storage.listBuckets();
  if (listErr) {
    return { error: listErr.message };
  }
  if (existing?.some((b) => b.name === bucket)) {
    return { error: null };
  }
  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: diplomeMaxBytes(),
    allowedMimeTypes: [...DIPLOME_MIME_ALLOWED],
  });
  if (error && !/already exists/i.test(error.message)) {
    return { error: error.message };
  }
  return { error: null };
}

export async function uploadDiplomeFile(
  storagePath: string,
  body: Buffer,
  mimeType: string,
): Promise<{ error: string | null }> {
  const bucketErr = await ensureDiplomeBucket();
  if (bucketErr.error) {
    return bucketErr;
  }

  const { error } = await supabase.storage
    .from(diplomeBucket())
    .upload(storagePath, body, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    const hint =
      /row-level security/i.test(error.message)
        ? " Applique prisma/supabase/diplomes-rls.sql dans Supabase (SQL Editor) ou vérifie SUPABASE_SERVICE_ROLE_KEY sur le serveur."
        : "";
    return { error: error.message + hint };
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
