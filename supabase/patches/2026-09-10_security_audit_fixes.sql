-- ==========================================
-- CORRECTIFS AUDIT DE SÉCURITÉ (2026-09-10)
-- Deux failles réelles trouvées lors d'un audit de sécurité complet du
-- projet :
--
-- 1) notify_low_stock n'importe quel business_id sans vérifier que
--    l'appelant appartient à ce commerce (GRANT à `authenticated`, aucun
--    contrôle is_business_member) : n'importe quel compte de l'app pouvait
--    déclencher une notification push, avec un texte entièrement libre,
--    vers les employés de N'IMPORTE QUEL AUTRE commerce.
--
-- 2) Toutes les fonctions qui journalisent une correction dans audit_logs
--    (cancel_sale, modify_sale, update_debt, update_purchase_order,
--    unreceive_purchase_order, delete_purchase_order, start_inventory,
--    validate_inventory) acceptaient l'identité de l'auteur (p_user_email)
--    comme simple texte envoyé par le client, jamais vérifié contre
--    auth.uid(). N'importe quel membre pouvait donc faire porter n'importe
--    quelle correction à un autre compte (y compris le propriétaire) dans
--    la page Sécurité — alors que c'est justement la page censée garantir
--    une trace de confiance. Corrigé en dérivant systématiquement l'auteur
--    côté serveur (public.current_actor_label), jamais depuis un paramètre
--    client : le paramètre p_user_email est retiré de la signature de
--    chaque fonction (DROP + recréation, pas juste CREATE OR REPLACE, pour
--    ne pas laisser l'ancienne signature vulnérable joignable en parallèle).
-- ==========================================

-- ------------------------------------------
-- 1) notify_low_stock : vérifie l'appartenance au commerce
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_low_stock(p_business_id uuid, p_product_name text, p_new_stock integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
    v_secret text;
BEGIN
    IF NOT public.is_business_member(p_business_id) THEN
        RETURN;
    END IF;

    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_notify_secret' LIMIT 1;
    IF v_secret IS NULL THEN
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := 'https://ewbxnyitytlilgmyjwba.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
        body := jsonb_build_object(
            'business_id', p_business_id,
            'title', 'Stock bas',
            'body', p_product_name || ' : ' || p_new_stock || ' restant(s)'
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- ------------------------------------------
-- 2) Auteur d'une correction dérivé côté serveur, jamais depuis le client.
-- Même logique que le frontend utilisait déjà pour choisir l'affichage
-- (nom du caissier si membre actif de ce commerce, sinon son email) — mais
-- calculée ici à partir de auth.uid(), donc impossible à falsifier.
-- SECURITY DEFINER : authenticated n'a normalement pas de droit de lecture
-- sur auth.users (voir log_login_success/log_failed_login plus haut dans
-- ce fichier, même contrainte).
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.current_actor_label(p_business_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT name FROM public.business_members
            WHERE business_id = p_business_id AND user_id = auth.uid() AND is_active
            LIMIT 1),
        (SELECT email FROM auth.users WHERE id = auth.uid())
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_actor_label(uuid) TO authenticated;

-- ------------------------------------------
-- cancel_sale / modify_sale
-- ------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_sale(uuid, text);

CREATE OR REPLACE FUNCTION public.cancel_sale(p_receipt_id uuid)
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
    VALUES (v_receipt.business_id, public.current_actor_label(v_receipt.business_id), 'CANCEL_SALE', p_receipt_id, jsonb_build_object('total_amount', v_receipt.total_amount));

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.modify_sale(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.modify_sale(
    p_receipt_id uuid,
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
            v_receipt.business_id, public.current_actor_label(v_receipt.business_id), 'MODIFY_SALE', p_receipt_id,
            jsonb_build_object('changes', v_changes, 'old_total', v_old_total, 'new_total', v_new_total)
        );
    END IF;

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.modify_sale(uuid, jsonb) TO authenticated;

-- ------------------------------------------
-- update_debt
-- ------------------------------------------
DROP FUNCTION IF EXISTS public.update_debt(uuid, text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.update_debt(
    p_debt_id uuid,
    p_customer_name text,
    p_customer_phone text,
    p_amount numeric,
    p_note text
)
RETURNS public.debts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_debt public.debts;
    v_changes jsonb;
BEGIN
    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dette introuvable';
    END IF;

    IF v_debt.customer_name IS DISTINCT FROM p_customer_name
        OR v_debt.customer_phone IS DISTINCT FROM p_customer_phone
        OR v_debt.amount IS DISTINCT FROM p_amount
        OR v_debt.note IS DISTINCT FROM p_note THEN

        v_changes := jsonb_build_object(
            'debt_id', p_debt_id,
            'before', jsonb_build_object(
                'customer_name', v_debt.customer_name,
                'customer_phone', v_debt.customer_phone,
                'amount', v_debt.amount,
                'note', v_debt.note
            ),
            'after', jsonb_build_object(
                'customer_name', p_customer_name,
                'customer_phone', p_customer_phone,
                'amount', p_amount,
                'note', p_note
            )
        );

        UPDATE public.debts
        SET customer_name = p_customer_name,
            customer_phone = p_customer_phone,
            amount = p_amount,
            note = p_note
        WHERE id = p_debt_id;

        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_debt.business_id, public.current_actor_label(v_debt.business_id), 'MODIFY_DEBT', v_changes);
    END IF;

    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id;
    RETURN v_debt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_debt(uuid, text, text, numeric, text) TO authenticated;

-- ------------------------------------------
-- update_purchase_order
-- ------------------------------------------
DROP FUNCTION IF EXISTS public.update_purchase_order(uuid, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_purchase_order(
    p_order_id uuid,
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
        VALUES (v_order.business_id, public.current_actor_label(v_order.business_id), 'MODIFY_PURCHASE_ORDER', jsonb_build_object(
            'order_id', p_order_id,
            'before', jsonb_build_object('supplier_id', v_order.supplier_id, 'total_amount', v_order.total_amount, 'items', v_before_items),
            'after', jsonb_build_object('supplier_id', p_supplier_id, 'total_amount', v_total, 'items', v_after_items)
        ));
    END IF;

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id;
    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_purchase_order(uuid, uuid, jsonb) TO authenticated;

-- ------------------------------------------
-- unreceive_purchase_order
-- ------------------------------------------
DROP FUNCTION IF EXISTS public.unreceive_purchase_order(uuid, text);

CREATE OR REPLACE FUNCTION public.unreceive_purchase_order(p_purchase_order_id uuid)
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
    VALUES (v_order.business_id, public.current_actor_label(v_order.business_id), 'UNRECEIVE_PURCHASE_ORDER', jsonb_build_object(
        'order_id', p_purchase_order_id,
        'total_amount', v_order.total_amount
    ));

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unreceive_purchase_order(uuid) TO authenticated;

-- ------------------------------------------
-- delete_purchase_order
-- ------------------------------------------
DROP FUNCTION IF EXISTS public.delete_purchase_order(uuid, text);

CREATE OR REPLACE FUNCTION public.delete_purchase_order(p_purchase_order_id uuid)
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
    VALUES (v_order.business_id, public.current_actor_label(v_order.business_id), 'DELETE_PURCHASE_ORDER', jsonb_build_object(
        'order_id', p_purchase_order_id,
        'status', v_order.status,
        'total_amount', v_order.total_amount,
        'items', v_items
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_purchase_order(uuid) TO authenticated;

-- ------------------------------------------
-- start_inventory / validate_inventory
-- ------------------------------------------
DROP FUNCTION IF EXISTS public.start_inventory(uuid, text, text);

CREATE OR REPLACE FUNCTION public.start_inventory(
    p_business_id uuid,
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
    VALUES (p_business_id, 'draft', p_note, public.current_actor_label(p_business_id))
    RETURNING * INTO v_inventory;

    INSERT INTO public.inventory_items (inventory_id, business_id, product_id, product_name, expected_quantity)
    SELECT v_inventory.id, p_business_id, id, name, stock_quantity
    FROM public.products
    WHERE business_id = p_business_id;

    RETURN v_inventory;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_inventory(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.validate_inventory(uuid, text);

CREATE OR REPLACE FUNCTION public.validate_inventory(p_inventory_id uuid)
RETURNS public.inventories
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_inventory public.inventories;
    v_item RECORD;
    v_adjustments jsonb := '[]'::jsonb;
    v_counted_count integer;
    v_actor text;
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

    v_actor := public.current_actor_label(v_inventory.business_id);

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
    SET status = 'validated', validated_at = timezone('utc'::text, now()), validated_by = v_actor
    WHERE id = p_inventory_id;

    IF jsonb_array_length(v_adjustments) > 0 THEN
        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_inventory.business_id, v_actor, 'VALIDATE_INVENTORY', jsonb_build_object(
            'inventory_id', p_inventory_id,
            'adjustments', v_adjustments
        ));
    END IF;

    SELECT * INTO v_inventory FROM public.inventories WHERE id = p_inventory_id;
    RETURN v_inventory;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_inventory(uuid) TO authenticated;
