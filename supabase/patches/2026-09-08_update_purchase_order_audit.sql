-- ==========================================
-- MODIFICATION D'UN BON DE COMMANDE, AVEC JOURNAL D'AUDIT
-- Corriger une erreur de saisie (fournisseur, articles, quantités, prix
-- d'achat) sur un bon pas encore reçu ne doit pas se faire en douce — même
-- schéma que update_debt : SECURITY INVOKER (s'appuie sur la policy RLS
-- existante de public.purchase_orders/purchase_order_items pour
-- l'autorisation), écrit dans audit_logs uniquement si quelque chose a
-- réellement changé, avec l'état avant/après. Un bon déjà reçu ou annulé
-- n'est plus modifiable (même restriction que receive_purchase_order) :
-- le stock a déjà bougé sur la base des lignes d'origine, les changer après
-- coup romprait la traçabilité.
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_purchase_order(
    p_order_id uuid,
    p_user_email text,
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
    v_before_items jsonb;
    v_after_items jsonb;
BEGIN
    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bon de commande introuvable';
    END IF;
    IF v_order.status <> 'pending' THEN
        RAISE EXCEPTION 'Seul un bon de commande en attente peut être modifié.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Le bon de commande est vide';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', product_name, 'quantity', quantity, 'unit_cost', unit_cost) ORDER BY id), '[]'::jsonb)
        INTO v_before_items
        FROM public.purchase_order_items WHERE purchase_order_id = p_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        v_unit_cost := (v_item->>'unit_cost')::numeric;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La quantité doit être supérieure à 0';
        END IF;

        SELECT * INTO v_product FROM public.products
            WHERE id = (v_item->>'product_id')::uuid
            AND business_id = v_order.business_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produit introuvable: %', v_item->>'product_id';
        END IF;

        v_total := v_total + (v_unit_cost * v_qty);
    END LOOP;

    DELETE FROM public.purchase_order_items WHERE purchase_order_id = p_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        v_unit_cost := (v_item->>'unit_cost')::numeric;
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;

        INSERT INTO public.purchase_order_items (purchase_order_id, business_id, product_id, product_name, quantity, unit_cost)
        VALUES (p_order_id, v_order.business_id, v_product.id, v_product.name, v_qty, v_unit_cost);
    END LOOP;

    UPDATE public.purchase_orders
    SET supplier_id = p_supplier_id, total_amount = v_total
    WHERE id = p_order_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', product_name, 'quantity', quantity, 'unit_cost', unit_cost) ORDER BY id), '[]'::jsonb)
        INTO v_after_items
        FROM public.purchase_order_items WHERE purchase_order_id = p_order_id;

    IF v_order.supplier_id IS DISTINCT FROM p_supplier_id
        OR v_order.total_amount IS DISTINCT FROM v_total
        OR v_before_items IS DISTINCT FROM v_after_items THEN

        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_order.business_id, p_user_email, 'MODIFY_PURCHASE_ORDER', jsonb_build_object(
            'order_id', p_order_id,
            'before', jsonb_build_object('supplier_id', v_order.supplier_id, 'total_amount', v_order.total_amount, 'items', v_before_items),
            'after', jsonb_build_object('supplier_id', p_supplier_id, 'total_amount', v_total, 'items', v_after_items)
        ));
    END IF;

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id;
    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_purchase_order(uuid, text, uuid, jsonb) TO authenticated;
