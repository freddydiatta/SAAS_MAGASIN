-- ==========================================
-- INVENTAIRES PHYSIQUES (comptage mensuel)
-- Démarrer un inventaire fige le stock théorique de chaque produit
-- (expected_quantity) au moment du démarrage. L'utilisateur saisit ensuite
-- le compté (counted_quantity) au fur et à mesure. Valider l'inventaire
-- applique le compté comme nouveau stock_quantity pour chaque article
-- réellement compté (les non-comptés restent inchangés) — c'est la seule
-- façon, avec une vente ou un bon de commande reçu, de faire bouger le
-- stock : là où on avait retiré les +/- à main levée dans Stock/Motos par
-- manque de traçabilité, l'inventaire est la voie légitime pour corriger
-- un écart réel (casse, vol, erreur de comptage), toujours journalisée.
-- ==========================================

CREATE TABLE public.inventories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'validated'
    note TEXT,
    created_by TEXT,
    validated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    validated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage inventories of their business"
ON public.inventories
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE TABLE public.inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id UUID REFERENCES public.inventories(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    expected_quantity INTEGER NOT NULL,
    counted_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage inventory items of their business"
ON public.inventory_items
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE INDEX idx_inventory_items_inventory_id ON public.inventory_items (inventory_id);
CREATE INDEX idx_inventories_business_id ON public.inventories (business_id, created_at DESC);

-- Démarre un inventaire : fige le stock théorique de chaque produit du
-- commerce dans une ligne d'inventory_items (counted_quantity NULL tant que
-- non compté). SECURITY INVOKER, comme create_purchase_order.
CREATE OR REPLACE FUNCTION public.start_inventory(
    p_business_id uuid,
    p_user_email text,
    p_note text
)
RETURNS public.inventories
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_inventory public.inventories;
BEGIN
    INSERT INTO public.inventories (business_id, status, note, created_by)
    VALUES (p_business_id, 'draft', p_note, p_user_email)
    RETURNING * INTO v_inventory;

    INSERT INTO public.inventory_items (inventory_id, business_id, product_id, product_name, expected_quantity)
    SELECT v_inventory.id, p_business_id, id, name, stock_quantity
    FROM public.products
    WHERE business_id = p_business_id;

    RETURN v_inventory;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_inventory(uuid, text, text) TO authenticated;

-- Valide l'inventaire : applique le compté comme nouveau stock pour chaque
-- article réellement compté et dont le compté diffère du théorique figé au
-- démarrage (les non-comptés ne bougent pas). Le stock est mis à la valeur
-- comptée telle quelle (vérité terrain), indépendamment d'éventuelles ventes
-- survenues pendant le comptage — le théorique figé sert uniquement à
-- expliquer l'écart dans le journal, pas à calculer la correction. Refuse
-- un inventaire déjà validé ou sans aucun article compté. Journalisée.
CREATE OR REPLACE FUNCTION public.validate_inventory(
    p_inventory_id uuid,
    p_user_email text
)
RETURNS public.inventories
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_inventory public.inventories;
    v_item RECORD;
    v_adjustments jsonb := '[]'::jsonb;
    v_counted_count integer;
BEGIN
    SELECT * INTO v_inventory FROM public.inventories WHERE id = p_inventory_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventaire introuvable';
    END IF;
    IF v_inventory.status <> 'draft' THEN
        RAISE EXCEPTION 'Cet inventaire a déjà été validé.';
    END IF;

    SELECT COUNT(*) INTO v_counted_count FROM public.inventory_items
        WHERE inventory_id = p_inventory_id AND counted_quantity IS NOT NULL;
    IF v_counted_count = 0 THEN
        RAISE EXCEPTION 'Comptez au moins un article avant de valider l''inventaire.';
    END IF;

    FOR v_item IN
        SELECT * FROM public.inventory_items
        WHERE inventory_id = p_inventory_id
        AND counted_quantity IS NOT NULL
        AND counted_quantity <> expected_quantity
        AND product_id IS NOT NULL
    LOOP
        UPDATE public.products SET stock_quantity = v_item.counted_quantity WHERE id = v_item.product_id;
        v_adjustments := v_adjustments || jsonb_build_object(
            'product_name', v_item.product_name,
            'expected', v_item.expected_quantity,
            'counted', v_item.counted_quantity,
            'difference', v_item.counted_quantity - v_item.expected_quantity
        );
    END LOOP;

    UPDATE public.inventories
    SET status = 'validated', validated_at = timezone('utc'::text, now()), validated_by = p_user_email
    WHERE id = p_inventory_id;

    IF jsonb_array_length(v_adjustments) > 0 THEN
        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_inventory.business_id, p_user_email, 'VALIDATE_INVENTORY', jsonb_build_object(
            'inventory_id', p_inventory_id,
            'adjustments', v_adjustments
        ));
    END IF;

    SELECT * INTO v_inventory FROM public.inventories WHERE id = p_inventory_id;
    RETURN v_inventory;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_inventory(uuid, text) TO authenticated;
