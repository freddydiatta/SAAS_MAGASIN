-- ==========================================
-- PHOTOS DE PRODUITS / MENU / VILLAS — à exécuter dans l'éditeur SQL de
-- Supabase.
--
-- Ajoute une colonne image_url sur products, menu_items et villas, un
-- bucket Storage public en lecture (product-images) pour héberger ces
-- photos, et les policies qui limitent l'upload/modification/suppression
-- aux membres du commerce concerné (propriétaire ou caissier actif) — la
-- lecture reste publique car ce ne sont que des photos d'articles,
-- affichées directement en <img src> dans l'app.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.villas ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Business members can upload their product images" ON storage.objects;
DROP POLICY IF EXISTS "Business members can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Business members can delete their product images" ON storage.objects;

CREATE POLICY "Public read access to product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Convention de chemin : product-images/<business_id>/<fichier> — le premier
-- segment du chemin doit être l'id du commerce, vérifié via is_business_member
-- (déjà utilisée ailleurs dans ce projet pour les mêmes policies RLS).
CREATE POLICY "Business members can upload their product images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Business members can update their product images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'product-images'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Business members can delete their product images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product-images'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);
