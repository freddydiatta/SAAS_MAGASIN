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

CREATE POLICY "Users can manage sales of their businesses"
ON public.sales
FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
);
