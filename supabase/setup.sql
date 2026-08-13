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
    quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage products of their businesses" ON public.products;
CREATE POLICY "Users can manage products of their businesses"
ON public.products
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);

-- 3. Mise à jour de la table Sales
CREATE TABLE public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
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
