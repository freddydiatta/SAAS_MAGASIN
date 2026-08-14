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
    price DECIMAL(10, 2),
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage products of their businesses" ON public.products;
CREATE POLICY "Users can manage products of their businesses"
ON public.products
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

-- 3. Mise à jour des Ventes (Receipts & Sales)
CREATE TABLE public.receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'completed', -- 'completed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage receipts of their businesses" ON public.receipts;
CREATE POLICY "Users can manage receipts of their businesses"
ON public.receipts
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

CREATE TABLE public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage sales of their businesses" ON public.sales;
CREATE POLICY "Users can manage sales of their businesses"
ON public.sales
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

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
    price_per_night DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'available', -- 'available', 'maintenance'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.villas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage villas of their businesses" ON public.villas;
CREATE POLICY "Users can manage villas of their businesses"
ON public.villas
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

CREATE TABLE public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    villa_id UUID REFERENCES public.villas(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage bookings of their businesses" ON public.bookings;
CREATE POLICY "Users can manage bookings of their businesses"
ON public.bookings
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

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
    price DECIMAL(10, 2) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage menu items of their businesses" ON public.menu_items;
CREATE POLICY "Users can manage menu items of their businesses"
ON public.menu_items
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

CREATE TABLE public.restaurant_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    table_number TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'served', 'paid', 'cancelled'
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { menu_item_id, name, quantity, price }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage restaurant orders of their businesses" ON public.restaurant_orders;
CREATE POLICY "Users can manage restaurant orders of their businesses"
ON public.restaurant_orders
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

-- ==========================================
-- AUDIT LOGS (Security & Traceability)
-- ==========================================
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_email TEXT,
    action TEXT NOT NULL, -- e.g., 'CANCEL_SALE', 'MODIFY_SALE'
    receipt_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and insert audit logs of their businesses" ON public.audit_logs;
CREATE POLICY "Users can view and insert audit logs of their businesses"
ON public.audit_logs
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

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
- -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
 - -   9 .   R P C   F u n c t i o n s   :   A f f i l i a t i o n  
 - -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   r e g i s t e r _ r e f e r r a l ( r e f _ c o d e   t e x t )  
 R E T U R N S   v o i d   A S   \ $ \ $  
 D E C L A R E  
         a f f _ i d   u u i d ;  
 B E G I N  
         S E L E C T   i d   I N T O   a f f _ i d   F R O M   p u b l i c . a f f i l i a t e s   W H E R E   r e f e r r a l _ c o d e   =   r e f _ c o d e ;  
         I F   a f f _ i d   I S   N O T   N U L L   T H E N  
                 I N S E R T   I N T O   p u b l i c . r e f e r r a l s   ( a f f i l i a t e _ i d ,   r e f e r r e d _ u s e r _ i d ,   s t a t u s )  
                 V A L U E S   ( a f f _ i d ,   a u t h . u i d ( ) ,   ' a c t i v e ' )  
                 O N   C O N F L I C T   ( r e f e r r e d _ u s e r _ i d )   D O   N O T H I N G ;  
         E N D   I F ;  
 E N D ;  
 \ $ \ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ;  
 
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
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'successful', 'failed'
    provider TEXT DEFAULT 'paydunya',
    transaction_id TEXT,
    payment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their payments" ON public.payments;
CREATE POLICY "Users can view their payments"
ON public.payments
FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

-- Note: L'insertion et la modification des paiements se feront via une Edge Function Supabase (Service Role)
