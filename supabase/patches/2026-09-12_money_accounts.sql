-- Où l'argent se trouve réellement : le tiroir-caisse, Wave, Orange Money...
-- L'application sait déjà ce qui a été encaissé et par quel moyen (voir la
-- répartition dans Finances), mais pas ce qu'il y a vraiment dans chaque
-- compte à l'instant T. Saisir ces soldes permet de recouper les deux :
-- l'écart entre ce que dit l'app et ce qu'on a en main est précisément ce
-- qu'un commerçant cherche en fin de journée.
--
-- Un simple solde à jour, pas un grand livre de mouvements : c'est ce qui se
-- vérifie d'un coup d'œil sur un téléphone, en comptant le tiroir.
CREATE TABLE IF NOT EXISTS public.money_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    -- Un solde saisi il y a trois jours ne veut plus rien dire : la date de
    -- mise à jour est affichée à côté du montant pour qu'on sache s'il est
    -- encore d'actualité.
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_money_accounts_business_id
    ON public.money_accounts (business_id, created_at);

ALTER TABLE public.money_accounts ENABLE ROW LEVEL SECURITY;

-- Réservé au propriétaire, comme les paiements et l'abonnement : un caissier
-- n'a pas à connaître le solde Wave du commerce (la page Finances lui est
-- déjà fermée, la base le refuse aussi).
DROP POLICY IF EXISTS "Owners can manage their money accounts" ON public.money_accounts;
CREATE POLICY "Owners can manage their money accounts"
ON public.money_accounts
FOR ALL USING (public.is_business_owner(business_id))
WITH CHECK (public.is_business_owner(business_id));
