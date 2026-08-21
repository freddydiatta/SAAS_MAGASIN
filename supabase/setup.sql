-- ==========================================
-- SCRIPT DE MIGRATION : MULTI-BUSINESS
-- A exécuter dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. Table des magasins (businesses)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Ex: 'pieces_moto', 'villa', 'quincaillerie', etc.
    subscription_plan TEXT DEFAULT 'essentiel', -- 'essentiel', 'business'
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS sur businesses
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Politique : L'utilisateur ne voit et modifie que ses propres magasins
DROP POLICY IF EXISTS "Users can manage their own businesses" ON public.businesses;
CREATE POLICY "Users can manage their own businesses"
ON public.businesses
FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 1bis. Caissiers (business_members) & fonctions d'autorisation
-- Un caissier a un vrai compte Supabase Auth distinct (créé par l'Edge
-- Function create-cashier), lié à son commerce ici. Le propriétaire garde
-- tous les droits (businesses.user_id) ; un caissier a accès à tout SAUF
-- la gestion du commerce lui-même (Paramètres : infos, abonnement, équipe).
-- Ces fonctions sont utilisées par toutes les policies définies plus bas.
-- ==========================================
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

DROP POLICY IF EXISTS "Members can view their business" ON public.businesses;
CREATE POLICY "Members can view their business"
ON public.businesses
FOR SELECT
USING (public.is_business_member(id));

-- 2. Mise à jour de la table Products
-- Ajouter business_id (si la table existe, on ajoute la colonne. Attention si des données existent, 
-- il faudra les assigner manuellement ou faire un drop. Pour ce script, on recrée proprement).

DROP TABLE IF EXISTS public.sales;
DROP TABLE IF EXISTS public.products;

CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    price DECIMAL(10, 2) CHECK (price >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage products of their businesses" ON public.products;
DROP POLICY IF EXISTS "Members can manage products of their businesses" ON public.products;
CREATE POLICY "Members can manage products of their businesses"
ON public.products
FOR ALL USING (public.is_business_member(business_id));

-- 3. Mise à jour des Ventes (Receipts & Sales)
CREATE TABLE public.receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT DEFAULT 'completed', -- 'completed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage receipts of their businesses" ON public.receipts;
DROP POLICY IF EXISTS "Members can manage receipts of their businesses" ON public.receipts;
CREATE POLICY "Members can manage receipts of their businesses"
ON public.receipts
FOR ALL USING (public.is_business_member(business_id));

CREATE TABLE public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage sales of their businesses" ON public.sales;
DROP POLICY IF EXISTS "Members can manage sales of their businesses" ON public.sales;
CREATE POLICY "Members can manage sales of their businesses"
ON public.sales
FOR ALL USING (public.is_business_member(business_id));

-- ==========================================
-- 4. Tables Spécifiques : VILLAS
-- ==========================================

DROP TABLE IF EXISTS public.bookings;
DROP TABLE IF EXISTS public.villas;

CREATE TABLE public.villas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    price_per_night DECIMAL(10, 2) NOT NULL CHECK (price_per_night >= 0),
    status TEXT DEFAULT 'available', -- 'available', 'maintenance'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.villas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage villas of their businesses" ON public.villas;
DROP POLICY IF EXISTS "Members can manage villas of their businesses" ON public.villas;
CREATE POLICY "Members can manage villas of their businesses"
ON public.villas
FOR ALL USING (public.is_business_member(business_id));

CREATE TABLE public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    villa_id UUID REFERENCES public.villas(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
    status TEXT DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage bookings of their businesses" ON public.bookings;
DROP POLICY IF EXISTS "Members can manage bookings of their businesses" ON public.bookings;
CREATE POLICY "Members can manage bookings of their businesses"
ON public.bookings
FOR ALL USING (public.is_business_member(business_id));

-- ==========================================
-- 5. Tables Spécifiques : RESTAURANT
-- ==========================================

DROP TABLE IF EXISTS public.restaurant_orders;
DROP TABLE IF EXISTS public.menu_items;

CREATE TABLE public.menu_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'plat', -- 'plat', 'boisson', 'dessert', etc.
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage menu items of their businesses" ON public.menu_items;
DROP POLICY IF EXISTS "Members can manage menu items of their businesses" ON public.menu_items;
CREATE POLICY "Members can manage menu items of their businesses"
ON public.menu_items
FOR ALL USING (public.is_business_member(business_id));

CREATE TABLE public.restaurant_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    table_number TEXT,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT DEFAULT 'pending', -- 'pending', 'served', 'paid', 'cancelled'
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { menu_item_id, name, quantity, price }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage restaurant orders of their businesses" ON public.restaurant_orders;
DROP POLICY IF EXISTS "Members can manage restaurant orders of their businesses" ON public.restaurant_orders;
CREATE POLICY "Members can manage restaurant orders of their businesses"
ON public.restaurant_orders
FOR ALL USING (public.is_business_member(business_id));

-- ==========================================
-- AUDIT LOGS (Security & Traceability)
-- ==========================================
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_email TEXT,
    action TEXT NOT NULL, -- e.g., 'CANCEL_SALE', 'MODIFY_SALE', 'LOGIN_SUCCESS', 'LOGIN_FAILED_PIN'
    receipt_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Journal immuable : les membres (caissiers inclus) peuvent uniquement
-- ajouter des entrées (ex. annulation de vente qu'ils effectuent eux-mêmes),
-- mais seul le propriétaire peut les consulter. Aucune policy UPDATE/DELETE
-- n'est définie : personne ne peut modifier ou effacer le journal via l'API.
DROP POLICY IF EXISTS "Users can view and insert audit logs of their businesses" ON public.audit_logs;
DROP POLICY IF EXISTS "Members can view and insert audit logs of their businesses" ON public.audit_logs;
DROP POLICY IF EXISTS "Members can insert audit logs of their businesses" ON public.audit_logs;
DROP POLICY IF EXISTS "Owner can view audit logs of their business" ON public.audit_logs;
CREATE POLICY "Members can insert audit logs of their businesses"
ON public.audit_logs
FOR INSERT WITH CHECK (public.is_business_member(business_id));
CREATE POLICY "Owner can view audit logs of their business"
ON public.audit_logs
FOR SELECT USING (public.is_business_owner(business_id));

-- Traçabilité des connexions : auth.audit_log_entries n'est pas fiable sur
-- ce projet (stockage Postgres désactivé côté plateforme par défaut), donc
-- on journalise nous-mêmes dans audit_logs via ces deux fonctions.
CREATE OR REPLACE FUNCTION public.log_login_success()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_email text;
    v_business RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

    FOR v_business IN
        SELECT b.id, 'owner' AS role FROM public.businesses b WHERE b.user_id = auth.uid()
        UNION ALL
        SELECT bm.business_id, 'cashier' FROM public.business_members bm
            WHERE bm.user_id = auth.uid() AND bm.is_active
    LOOP
        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_business.id, v_email, 'LOGIN_SUCCESS', jsonb_build_object('role', v_business.role));
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.log_login_success() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_login_success() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_login_success() FROM anon;

CREATE OR REPLACE FUNCTION public.log_failed_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_business RECORD;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_business IN SELECT id FROM public.businesses WHERE user_id = v_user_id
    LOOP
        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_business.id, p_email, 'LOGIN_FAILED', jsonb_build_object('role', 'owner'));
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.log_failed_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_failed_login(text) TO authenticated, anon;

-- ==========================================
-- 8. Tables Spécifiques : AFFILIATION
-- ==========================================

DROP TABLE IF EXISTS public.commissions;
DROP TABLE IF EXISTS public.referrals;
DROP TABLE IF EXISTS public.affiliates;

CREATE TABLE public.affiliates (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT UNIQUE NOT NULL,
    commission_rate DECIMAL(5, 2) DEFAULT 20.00, -- 20% by default
    total_earnings DECIMAL(10, 2) DEFAULT 0.00,
    paypal_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own affiliate profile"
ON public.affiliates FOR ALL USING (id = auth.uid());

CREATE TABLE public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(referred_user_id) -- A user can only be referred once
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view their referrals"
ON public.referrals FOR SELECT USING (affiliate_id = auth.uid());

CREATE TABLE public.commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view their commissions"
ON public.commissions FOR SELECT USING (affiliate_id = auth.uid());
-- ==========================================
-- 9. RPC Functions : Affiliation
-- ==========================================
CREATE OR REPLACE FUNCTION register_referral(ref_code text)
RETURNS void AS $$
DECLARE
    aff_id uuid;
BEGIN
    SELECT id INTO aff_id FROM public.affiliates WHERE referral_code = ref_code;
    IF aff_id IS NOT NULL THEN
        INSERT INTO public.referrals (affiliate_id, referred_user_id, status)
        VALUES (aff_id, auth.uid(), 'active')
        ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_referral(text) TO authenticated;

-- ==========================================
-- 10. Tables Sp�cifiques : PAIEMENTS & ABONNEMENTS (SaaS)
-- ==========================================

-- Mise � jour de la table businesses pour g�rer les abonnements
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active'; -- 'active', 'past_due', 'canceled'
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '14 days');

-- Table pour l'historique des paiements via PayDunya
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    status TEXT DEFAULT 'pending', -- 'pending', 'successful', 'failed'
    provider TEXT DEFAULT 'paydunya',
    transaction_id TEXT,
    payment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their payments" ON public.payments;
DROP POLICY IF EXISTS "Owners can view their payments" ON public.payments;
CREATE POLICY "Owners can view their payments"
ON public.payments
FOR SELECT USING (public.is_business_owner(business_id));

-- Note: L'insertion et la modification des paiements se feront via une Edge Function Supabase (Service Role)

-- ==========================================
-- 11. RPC Functions : Ventes atomiques
-- Remplacent les écritures multi-étapes faites côté client (insert
-- puis update stock séparément), qui ne sont pas transactionnelles et
-- exposent à des incohérences stock/ventes en cas d'échec partiel ou
-- de ventes concurrentes.
-- ==========================================

CREATE OR REPLACE FUNCTION public.process_sale(
    p_business_id uuid,
    p_customer_name text,
    p_customer_phone text,
    p_payment_method text,
    p_items jsonb, -- [{ "product_id": uuid, "quantity": int }, ...]
    p_created_at timestamptz DEFAULT NULL
)
RETURNS public.receipts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receipt public.receipts;
    v_item jsonb;
    v_product public.products%ROWTYPE;
    v_qty integer;
    v_total numeric := 0;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Le panier est vide';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;

        SELECT * INTO v_product FROM public.products
            WHERE id = (v_item->>'product_id')::uuid
            AND business_id = p_business_id
            FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produit introuvable: %', v_item->>'product_id';
        END IF;

        IF v_product.stock_quantity < v_qty THEN
            RAISE EXCEPTION 'Stock insuffisant pour "%": disponible %, demandé %', v_product.name, v_product.stock_quantity, v_qty;
        END IF;

        v_total := v_total + (v_product.price * v_qty);
    END LOOP;

    INSERT INTO public.receipts (business_id, customer_name, customer_phone, total_amount, status, payment_method, created_at)
    VALUES (
        p_business_id, p_customer_name, p_customer_phone, v_total, 'completed', p_payment_method,
        COALESCE(p_created_at, timezone('utc'::text, now()))
    )
    RETURNING * INTO v_receipt;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;

        INSERT INTO public.sales (business_id, receipt_id, product_id, quantity, total_price)
        VALUES (p_business_id, v_receipt.id, v_product.id, v_qty, v_product.price * v_qty);

        UPDATE public.products SET stock_quantity = stock_quantity - v_qty WHERE id = v_product.id;
    END LOOP;

    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_sale(
    p_receipt_id uuid,
    p_user_email text
)
RETURNS public.receipts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receipt public.receipts;
    v_sale RECORD;
BEGIN
    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vente introuvable';
    END IF;

    IF v_receipt.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cette vente est déjà annulée.';
    END IF;

    UPDATE public.receipts SET status = 'cancelled' WHERE id = p_receipt_id;

    FOR v_sale IN SELECT * FROM public.sales WHERE receipt_id = p_receipt_id
    LOOP
        IF v_sale.product_id IS NOT NULL THEN
            UPDATE public.products
                SET stock_quantity = stock_quantity + v_sale.quantity
                WHERE id = v_sale.product_id;
        END IF;
    END LOOP;

    INSERT INTO public.audit_logs (business_id, user_email, action, receipt_id, details)
    VALUES (v_receipt.business_id, p_user_email, 'CANCEL_SALE', p_receipt_id, jsonb_build_object('total_amount', v_receipt.total_amount));

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.modify_sale(
    p_receipt_id uuid,
    p_user_email text,
    p_items jsonb -- [{ "sale_id": uuid, "product_id": uuid|null, "name": text, "original_qty": int, "new_qty": int, "price": numeric }]
)
RETURNS public.receipts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receipt public.receipts;
    v_item jsonb;
    v_qty_diff integer;
    v_new_qty integer;
    v_item_total numeric;
    v_new_total numeric := 0;
    v_old_total numeric;
    v_changes jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vente introuvable';
    END IF;
    v_old_total := v_receipt.total_amount;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_new_qty := (v_item->>'new_qty')::integer;
        v_item_total := v_new_qty * (v_item->>'price')::numeric;
        v_new_total := v_new_total + v_item_total;
        v_qty_diff := v_new_qty - (v_item->>'original_qty')::integer;

        IF v_qty_diff <> 0 THEN
            UPDATE public.sales
                SET quantity = v_new_qty, total_price = v_item_total
                WHERE id = (v_item->>'sale_id')::uuid;

            IF (v_item->>'product_id') IS NOT NULL THEN
                UPDATE public.products
                    SET stock_quantity = stock_quantity - v_qty_diff
                    WHERE id = (v_item->>'product_id')::uuid;
            END IF;

            v_changes := v_changes || jsonb_build_object(
                'product', v_item->>'name',
                'old_qty', (v_item->>'original_qty')::integer,
                'new_qty', v_new_qty
            );
        END IF;
    END LOOP;

    IF v_new_total <> v_old_total THEN
        UPDATE public.receipts SET total_amount = v_new_total WHERE id = p_receipt_id;
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
        INSERT INTO public.audit_logs (business_id, user_email, action, receipt_id, details)
        VALUES (
            v_receipt.business_id, p_user_email, 'MODIFY_SALE', p_receipt_id,
            jsonb_build_object('changes', v_changes, 'old_total', v_old_total, 'new_total', v_new_total)
        );
    END IF;

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.modify_sale(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_product_id uuid,
    p_change integer
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_product public.products;
BEGIN
    UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity + p_change)
        WHERE id = p_product_id
        RETURNING * INTO v_product;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produit introuvable';
    END IF;

    RETURN v_product;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) TO authenticated;
