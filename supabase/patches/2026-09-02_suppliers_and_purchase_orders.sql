-- ==========================================
-- FOURNISSEURS + BONS DE COMMANDE (RÉAPPROVISIONNEMENT)
-- Deuxième étape du suivi fournisseurs, après le prix d'achat par produit
-- (2026-09-02_product_cost_price.sql). Un produit peut être rattaché à un
-- fournisseur préféré ; un bon de commande fige les quantités/prix d'achat
-- au moment de la commande (product_name/unit_cost recopiés sur la ligne,
-- pas de simple FK vers products, pour que l'historique reste correct même
-- si le produit est ensuite modifié ou supprimé). La réception d'un bon
-- augmente le stock des produits concernés de façon atomique.
-- ==========================================

CREATE TABLE public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage suppliers of their business"
ON public.suppliers
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

ALTER TABLE public.products ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE TABLE public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'received', 'cancelled'
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage purchase orders of their business"
ON public.purchase_orders
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE TABLE public.purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage purchase order items of their business"
ON public.purchase_order_items
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE INDEX idx_purchase_order_items_order_id ON public.purchase_order_items (purchase_order_id);
CREATE INDEX idx_purchase_orders_business_id ON public.purchase_orders (business_id, created_at DESC);

-- Création atomique du bon de commande + ses lignes (même schéma de
-- fonctionnement que process_sale : boucle de validation d'abord, insertion
-- ensuite). SECURITY INVOKER : s'appuie sur les policies RLS ci-dessus
-- (is_business_member) pour l'autorisation, comme process_sale/cancel_sale.
CREATE OR REPLACE FUNCTION public.create_purchase_order(
    p_business_id uuid,
    p_supplier_id uuid,
    p_items jsonb -- [{ "product_id": uuid, "quantity": int, "unit_cost": numeric }, ...]
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_order public.purchase_orders;
    v_item jsonb;
    v_product public.products%ROWTYPE;
    v_qty integer;
    v_unit_cost numeric;
    v_total numeric := 0;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Le bon de commande est vide';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        v_unit_cost := (v_item->>'unit_cost')::numeric;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La quantité doit être supérieure à 0';
        END IF;

        SELECT * INTO v_product FROM public.products
            WHERE id = (v_item->>'product_id')::uuid
            AND business_id = p_business_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produit introuvable: %', v_item->>'product_id';
        END IF;

        v_total := v_total + (v_unit_cost * v_qty);
    END LOOP;

    INSERT INTO public.purchase_orders (business_id, supplier_id, status, total_amount)
    VALUES (p_business_id, p_supplier_id, 'pending', v_total)
    RETURNING * INTO v_order;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        v_unit_cost := (v_item->>'unit_cost')::numeric;
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;

        INSERT INTO public.purchase_order_items (purchase_order_id, business_id, product_id, product_name, quantity, unit_cost)
        VALUES (v_order.id, p_business_id, v_product.id, v_product.name, v_qty, v_unit_cost);
    END LOOP;

    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, jsonb) TO authenticated;

-- Réception : augmente le stock de chaque produit de la quantité commandée,
-- puis marque le bon comme reçu. Refuse un bon déjà reçu/annulé (pas de
-- double-incrément de stock en cliquant deux fois).
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_purchase_order_id uuid)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_order public.purchase_orders;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bon de commande introuvable';
    END IF;
    IF v_order.status <> 'pending' THEN
        RAISE EXCEPTION 'Ce bon de commande a déjà été traité.';
    END IF;

    FOR v_item IN SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_purchase_order_id
    LOOP
        IF v_item.product_id IS NOT NULL THEN
            UPDATE public.products SET stock_quantity = stock_quantity + v_item.quantity WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    UPDATE public.purchase_orders
    SET status = 'received', received_at = timezone('utc'::text, now())
    WHERE id = p_purchase_order_id;

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;
