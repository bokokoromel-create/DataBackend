-- Diplômes : politiques Supabase Storage + table "Diplome"
-- À exécuter une fois dans Supabase → SQL Editor (projet Data Horizon).
--
-- Deux flux supportés :
-- 1) Recommandé : POST /me/diplome (API Node + SUPABASE_SERVICE_ROLE_KEY)
-- 2) Upload direct navigateur : dossier Storage = auth.uid() / fichier

-- ── Storage (bucket "diplomes", privé) ─────────────────────────────────────

-- Supprime d’anciennes policies du même nom si re-exécution
DROP POLICY IF EXISTS "diplomes_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "diplomes_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "diplomes_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "diplomes_storage_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "diplomes_storage_service_all" ON storage.objects;

-- Participant authentifié : son dossier {auth.uid()}/...
CREATE POLICY "diplomes_storage_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'diplomes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "diplomes_storage_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diplomes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "diplomes_storage_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'diplomes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'diplomes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "diplomes_storage_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'diplomes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Backend (service_role) : accès complet au bucket (défense en profondeur)
CREATE POLICY "diplomes_storage_service_all"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'diplomes')
WITH CHECK (bucket_id = 'diplomes');

-- ── Table "Diplome" (PostgREST / client Supabase optionnel) ────────────────
-- Prisma (DATABASE_URL postgres) contourne RLS ; utile si le front écrit via supabase-js.

ALTER TABLE "Diplome" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diplome_select_own" ON "Diplome";
DROP POLICY IF EXISTS "diplome_insert_own" ON "Diplome";
DROP POLICY IF EXISTS "diplome_update_own" ON "Diplome";
DROP POLICY IF EXISTS "diplome_delete_own" ON "Diplome";
DROP POLICY IF EXISTS "diplome_service_all" ON "Diplome";

CREATE POLICY "diplome_select_own"
ON "Diplome" FOR SELECT TO authenticated
USING (
  "userId" IN (
    SELECT id FROM "User" WHERE "supabaseId" = (auth.uid())::text
  )
);

CREATE POLICY "diplome_insert_own"
ON "Diplome" FOR INSERT TO authenticated
WITH CHECK (
  "userId" IN (
    SELECT id FROM "User" WHERE "supabaseId" = (auth.uid())::text
  )
);

CREATE POLICY "diplome_update_own"
ON "Diplome" FOR UPDATE TO authenticated
USING (
  "userId" IN (
    SELECT id FROM "User" WHERE "supabaseId" = (auth.uid())::text
  )
);

CREATE POLICY "diplome_delete_own"
ON "Diplome" FOR DELETE TO authenticated
USING (
  "userId" IN (
    SELECT id FROM "User" WHERE "supabaseId" = (auth.uid())::text
  )
);

CREATE POLICY "diplome_service_all"
ON "Diplome" FOR ALL TO service_role
USING (true)
WITH CHECK (true);
