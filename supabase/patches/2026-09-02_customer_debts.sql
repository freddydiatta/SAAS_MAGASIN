-- ==========================================
-- DETTES CLIENTS (CRÉDIT)
-- Première étape : qui doit de l'argent, combien, depuis quand, et un
-- statut remboursé/non remboursé qu'on bascule en un clic. Partagé par
-- tous les verticaux (retail/motos, restaurant, villas) comme les
-- dépenses — l'argent prêté à un client ne dépend pas du métier. Pas de
-- lien avec une vente précise pour l'instant : un client peut demander à
-- être remboursé plus tard sans que ce soit forcément rattaché à un achat
-- particulier ce jour-là.
-- ==========================================

CREATE TABLE public.debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    note TEXT,
    status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage debts of their business"
ON public.debts
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE INDEX idx_debts_business_id ON public.debts (business_id, created_at DESC);
