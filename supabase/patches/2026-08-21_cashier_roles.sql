-- ==========================================
-- RÔLES CAISSIER — à exécuter dans l'éditeur SQL de Supabase
-- Sans danger sur une base contenant déjà des données (pas de DROP TABLE,
-- les policies sont recréées via DROP POLICY IF EXISTS + CREATE POLICY).
--
-- Modèle : un caissier a un vrai compte Supabase Auth distinct (créé par
-- l'Edge Function create-cashier), lié à son commerce via business_members.
-- Le propriétaire garde tous les droits (via businesses.user_id) ; un
-- caissier a accès à tout SAUF la gestion du commerce lui-même (Paramètres :
-- infos du commerce, abonnement, gestion des caissiers).
-- ==========================================

-- ------------------------------------------
-- 1. Table des membres (caissiers) d'un commerce
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    pin_hash TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (business_id, user_id)
);

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- 2. Fonctions d'autorisation réutilisées par toutes les policies
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = p_business_id AND b.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.is_business_owner(p_business_id)
        OR EXISTS (
            SELECT 1 FROM public.business_members m
            WHERE m.business_id = p_business_id
              AND m.user_id = auth.uid()
              AND m.is_active = true
        );
$$;

GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated;

-- ------------------------------------------
-- 3. Policies sur business_members
--    Le propriétaire gère (CRUD) ses caissiers ; un caissier ne peut lire
--    que sa propre ligne (pour connaître son nom/rôle une fois connecté).
--    pin_hash / encrypted_credentials ne sont jamais exposés au client :
--    voir la vue business_members_safe ci-dessous, utilisée par le front.
-- ------------------------------------------
DROP POLICY IF EXISTS "Owners manage their business members" ON public.business_members;
CREATE POLICY "Owners manage their business members"
ON public.business_members
FOR ALL
USING (public.is_business_owner(business_id))
WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "Members can read their own membership row" ON public.business_members;
CREATE POLICY "Members can read their own membership row"
ON public.business_members
FOR SELECT
USING (user_id = auth.uid());

CREATE OR REPLACE VIEW public.business_members_safe
WITH (security_invoker = true) AS
SELECT id, business_id, user_id, name, role, is_active, created_at
FROM public.business_members;

GRANT SELECT ON public.business_members_safe TO authenticated;

-- ------------------------------------------
-- 4. businesses : le propriétaire garde tous les droits (policy déjà en
--    place) ; on ajoute une lecture seule pour les membres, nécessaire
--    pour que l'app puisse charger le commerce d'un caissier connecté.
-- ------------------------------------------
DROP POLICY IF EXISTS "Members can view their business" ON public.businesses;
CREATE POLICY "Members can view their business"
ON public.businesses
FOR SELECT
USING (public.is_business_member(id));

-- ------------------------------------------
-- 5. Tables métier : un caissier a le même accès que le propriétaire
--    (encaisser, annuler/modifier une vente, gérer le stock, etc. — tout
--    reste tracé dans audit_logs). Remplace les anciennes policies basées
--    sur "business_id IN (SELECT id FROM businesses WHERE user_id = ...)".
-- ------------------------------------------
DROP POLICY IF EXISTS "Users can manage products of their businesses" ON public.products;
CREATE POLICY "Members can manage products of their businesses"
ON public.products FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can manage receipts of their businesses" ON public.receipts;
CREATE POLICY "Members can manage receipts of their businesses"
ON public.receipts FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can manage sales of their businesses" ON public.sales;
CREATE POLICY "Members can manage sales of their businesses"
ON public.sales FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can manage villas of their businesses" ON public.villas;
CREATE POLICY "Members can manage villas of their businesses"
ON public.villas FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can manage bookings of their businesses" ON public.bookings;
CREATE POLICY "Members can manage bookings of their businesses"
ON public.bookings FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can manage menu items of their businesses" ON public.menu_items;
CREATE POLICY "Members can manage menu items of their businesses"
ON public.menu_items FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can manage restaurant orders of their businesses" ON public.restaurant_orders;
CREATE POLICY "Members can manage restaurant orders of their businesses"
ON public.restaurant_orders FOR ALL USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "Users can view and insert audit logs of their businesses" ON public.audit_logs;
CREATE POLICY "Members can view and insert audit logs of their businesses"
ON public.audit_logs FOR ALL USING (public.is_business_member(business_id));

-- ------------------------------------------
-- 6. payments : données de facturation/abonnement — considérées comme
--    faisant partie des "Paramètres", donc réservées au propriétaire.
-- ------------------------------------------
DROP POLICY IF EXISTS "Users can view their payments" ON public.payments;
CREATE POLICY "Owners can view their payments"
ON public.payments FOR SELECT USING (public.is_business_owner(business_id));
