-- ==========================================
-- SUIVI DES DÉPENSES — à exécuter dans l'éditeur SQL de Supabase.
--
-- Jusqu'ici rien ne permettait d'enregistrer les dépenses (transport,
-- divers...) : seul le chiffre d'affaires était visible, donc impossible
-- de connaître le bénéfice réel. Une seule table, partagée par tous les
-- verticaux (retail/motos, restaurant, villas) — même logique de
-- dépense → bénéfice partout, pas de raison de la dupliquer.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'divers', -- 'transport', 'divers', ...
    label TEXT, -- précision libre, notamment pour "divers" (cf. demande explicite)
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    created_by TEXT, -- email/nom de qui a enregistré la dépense, pour traçabilité
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage expenses of their business" ON public.expenses;
CREATE POLICY "Members can manage expenses of their business"
ON public.expenses
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE INDEX IF NOT EXISTS idx_expenses_business_created_at
    ON public.expenses (business_id, created_at DESC);
