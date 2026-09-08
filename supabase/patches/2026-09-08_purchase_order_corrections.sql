-- ==========================================
-- CORRECTIONS SUR LES BONS DE COMMANDE : prix d'achat aligné sur l'achat
-- réel, annuler une réception faite par erreur, supprimer un bon.
-- ==========================================

-- 1) La réception aligne aussi le prix d'achat du produit sur celui payé
-- sur ce bon (avant, seul le stock bougeait) — le prix d'achat affiché
-- dans Stock reste ainsi toujours celui du dernier réapprovisionnement
-- réel plutôt qu'une valeur saisie à la main qui dérive de Fournisseurs.
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
            UPDATE public.products
            SET stock_quantity = stock_quantity + v_item.quantity,
                cost_price = v_item.unit_cost
            WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    UPDATE public.purchase_orders
    SET status = 'received', received_at = timezone('utc'::text, now())
    WHERE id = p_purchase_order_id;

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN v_order;
END;
$$;

-- 2) Annuler la réception d'un bon marqué reçu par erreur : repasse en
-- 'pending' et retire le stock ajouté. Refuse explicitement (produit +
-- quantité, même style que process_sale) si une partie a déjà été
-- revendue depuis. Journalisé.
CREATE OR REPLACE FUNCTION public.unreceive_purchase_order(
    p_purchase_order_id uuid,
    p_user_email text
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_order public.purchase_orders;
    v_item RECORD;
    v_product public.products%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bon de commande introuvable';
    END IF;
    IF v_order.status <> 'received' THEN
        RAISE EXCEPTION 'Seul un bon de commande marqué reçu peut voir sa réception annulée.';
    END IF;

    FOR v_item IN SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_purchase_order_id
    LOOP
        IF v_item.product_id IS NOT NULL THEN
            SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
            IF FOUND AND v_product.stock_quantity < v_item.quantity THEN
                RAISE EXCEPTION 'Impossible d''annuler la réception : stock actuel de "%" insuffisant (disponible %, à retirer %) — une partie a probablement déjà été revendue.', v_product.name, v_product.stock_quantity, v_item.quantity;
            END IF;
        END IF;
    END LOOP;

    FOR v_item IN SELECT * FROM public.purchase_order_items WHERE purchase_order_id = p_purchase_order_id
    LOOP
        IF v_item.product_id IS NOT NULL THEN
            UPDATE public.products SET stock_quantity = stock_quantity - v_item.quantity WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    UPDATE public.purchase_orders
    SET status = 'pending', received_at = NULL
    WHERE id = p_purchase_order_id;

    INSERT INTO public.audit_logs (business_id, user_email, action, details)
    VALUES (v_order.business_id, p_user_email, 'UNRECEIVE_PURCHASE_ORDER', jsonb_build_object(
        'order_id', p_purchase_order_id,
        'total_amount', v_order.total_amount
    ));

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unreceive_purchase_order(uuid, text) TO authenticated;

-- 3) Supprimer un bon en attente ou annulé (jamais un bon reçu — passer
-- par unreceive_purchase_order d'abord). Journalisé avant suppression
-- puisque les lignes disparaissent avec le bon (ON DELETE CASCADE).
CREATE OR REPLACE FUNCTION public.delete_purchase_order(
    p_purchase_order_id uuid,
    p_user_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_order public.purchase_orders;
    v_items jsonb;
BEGIN
    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bon de commande introuvable';
    END IF;
    IF v_order.status = 'received' THEN
        RAISE EXCEPTION 'Un bon de commande reçu ne peut pas être supprimé (le stock a déjà été mis à jour) : annulez d''abord sa réception.';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_name', product_name, 'quantity', quantity, 'unit_cost', unit_cost)), '[]'::jsonb)
        INTO v_items
        FROM public.purchase_order_items WHERE purchase_order_id = p_purchase_order_id;

    DELETE FROM public.purchase_orders WHERE id = p_purchase_order_id;

    INSERT INTO public.audit_logs (business_id, user_email, action, details)
    VALUES (v_order.business_id, p_user_email, 'DELETE_PURCHASE_ORDER', jsonb_build_object(
        'order_id', p_purchase_order_id,
        'status', v_order.status,
        'total_amount', v_order.total_amount,
        'items', v_items
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_purchase_order(uuid, text) TO authenticated;
