-- Une vente à crédit crée une dette du montant du reçu (voir Caisse.jsx).
-- Mais corriger ou annuler cette vente ne touchait pas la dette : le client
-- restait redevable de l'ancien montant, voire d'une vente annulée qui
-- n'existait plus. La dette doit suivre la vente dont elle est née.
--
-- Cas déjà remboursé : l'argent a changé de mains, corriger ou annuler
-- supposerait un remboursement au client, que l'application ne sait pas
-- représenter. On refuse explicitement plutôt que de laisser les chiffres
-- diverger en silence.

CREATE OR REPLACE FUNCTION public.cancel_sale(
    p_receipt_id uuid
)
RETURNS public.receipts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receipt public.receipts;
    v_sale RECORD;
    v_debt_amount numeric;
BEGIN
    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vente introuvable';
    END IF;

    IF v_receipt.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cette vente est déjà annulée.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.debts WHERE receipt_id = p_receipt_id AND status = 'paid') THEN
        RAISE EXCEPTION 'Cette vente à crédit a déjà été remboursée : elle ne peut plus être annulée.';
    END IF;

    -- Dette encore due : la vente disparaît, ce qu'elle devait aussi. Sans ça,
    -- le client resterait redevable d'une vente annulée.
    SELECT SUM(amount) INTO v_debt_amount FROM public.debts WHERE receipt_id = p_receipt_id;
    DELETE FROM public.debts WHERE receipt_id = p_receipt_id;

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
    VALUES (v_receipt.business_id, public.current_actor_label(v_receipt.business_id), 'CANCEL_SALE', p_receipt_id,
            jsonb_build_object('total_amount', v_receipt.total_amount, 'debt_cleared', v_debt_amount));

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.modify_sale(
    p_receipt_id uuid,
    p_items jsonb -- [{ "sale_id": uuid|null, "product_id": uuid, "new_qty": int }]
)
RETURNS public.receipts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receipt public.receipts;
    v_item jsonb;
    v_sale public.sales%ROWTYPE;
    v_product public.products%ROWTYPE;
    v_sale_id uuid;
    v_product_id uuid;
    v_new_qty integer;
    v_orig_qty integer;
    v_qty_diff integer;
    v_unit_price numeric;
    v_unit_cost numeric;
    v_name text;
    v_old_total numeric;
    v_new_total numeric;
    v_remaining integer;
    v_debt_updated boolean := false;
    v_changes jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vente introuvable';
    END IF;
    IF v_receipt.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cette vente est annulée : elle ne peut plus être modifiée.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.debts WHERE receipt_id = p_receipt_id AND status = 'paid') THEN
        RAISE EXCEPTION 'Cette vente à crédit a déjà été remboursée : elle ne peut plus être corrigée.';
    END IF;
    v_old_total := v_receipt.total_amount;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_id := NULLIF(v_item->>'sale_id', '')::uuid;
        v_new_qty := (v_item->>'new_qty')::integer;

        IF v_new_qty < 0 THEN
            RAISE EXCEPTION 'Quantité invalide';
        END IF;

        IF v_sale_id IS NOT NULL THEN
            -- Ligne existante : le prix unitaire reste celui facturé au
            -- moment de la vente, pas le prix courant du produit.
            SELECT * INTO v_sale FROM public.sales
                WHERE id = v_sale_id AND receipt_id = p_receipt_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Ligne de vente introuvable sur cette vente';
            END IF;
            v_product_id := v_sale.product_id;
            v_orig_qty := v_sale.quantity;
            v_unit_price := v_sale.total_price / v_sale.quantity;
            v_unit_cost := CASE WHEN v_sale.total_cost IS NULL
                                THEN NULL ELSE v_sale.total_cost / v_sale.quantity END;
        ELSE
            -- Ligne ajoutée pendant la correction : prix et coût du jour.
            v_product_id := (v_item->>'product_id')::uuid;
            SELECT * INTO v_product FROM public.products
                WHERE id = v_product_id AND business_id = v_receipt.business_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Produit introuvable';
            END IF;
            v_orig_qty := 0;
            v_unit_price := v_product.price;
            v_unit_cost := v_product.cost_price;
        END IF;

        v_qty_diff := v_new_qty - v_orig_qty;

        -- Le stock suit l'écart : rendre des unités le regarnit, en prendre
        -- davantage l'entame — et ne doit pas faire vendre ce qu'on n'a pas.
        IF v_qty_diff <> 0 AND v_product_id IS NOT NULL THEN
            SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
            IF FOUND THEN
                IF v_qty_diff > 0 AND v_product.stock_quantity < v_qty_diff THEN
                    RAISE EXCEPTION 'Stock insuffisant pour "%": disponible %, demandé %',
                        v_product.name, v_product.stock_quantity, v_qty_diff;
                END IF;
                UPDATE public.products
                    SET stock_quantity = stock_quantity - v_qty_diff
                    WHERE id = v_product_id;
                v_name := v_product.name;
            END IF;
        ELSIF v_product_id IS NOT NULL THEN
            SELECT name INTO v_name FROM public.products WHERE id = v_product_id;
        END IF;

        IF v_new_qty = 0 THEN
            -- sales.quantity a un CHECK > 0 : une ligne vidée se supprime,
            -- elle ne se met pas à zéro.
            IF v_sale_id IS NOT NULL THEN
                DELETE FROM public.sales WHERE id = v_sale_id;
            END IF;
        ELSIF v_sale_id IS NOT NULL THEN
            UPDATE public.sales
                SET quantity = v_new_qty,
                    total_price = v_unit_price * v_new_qty,
                    total_cost = v_unit_cost * v_new_qty
                WHERE id = v_sale_id;
        ELSE
            INSERT INTO public.sales (business_id, receipt_id, product_id, quantity, total_price, total_cost)
            VALUES (v_receipt.business_id, p_receipt_id, v_product_id, v_new_qty,
                    v_unit_price * v_new_qty, v_unit_cost * v_new_qty);
        END IF;

        IF v_qty_diff <> 0 THEN
            v_changes := v_changes || jsonb_build_object(
                'product', COALESCE(v_name, 'Produit'),
                'old_qty', v_orig_qty,
                'new_qty', v_new_qty
            );
        END IF;
    END LOOP;

    -- Une vente sans aucune ligne n'est pas une vente corrigée : c'est une
    -- vente annulée, et il existe une action dédiée qui la trace comme telle.
    SELECT COUNT(*) INTO v_remaining FROM public.sales WHERE receipt_id = p_receipt_id;
    IF v_remaining = 0 THEN
        RAISE EXCEPTION 'Une vente doit garder au moins un article. Utilisez "Annuler la vente".';
    END IF;

    -- Total recalculé depuis les lignes réellement en base plutôt que depuis
    -- ce que le client a envoyé : reste juste même si une ligne n'était pas
    -- dans la correction.
    SELECT COALESCE(SUM(total_price), 0) INTO v_new_total
        FROM public.sales WHERE receipt_id = p_receipt_id;

    IF v_new_total <> v_old_total THEN
        UPDATE public.receipts SET total_amount = v_new_total WHERE id = p_receipt_id;

        -- La dette née de cette vente à crédit vaut ce que la vente vaut
        -- désormais : sans ça, le client resterait redevable de l'ancien
        -- montant après un échange.
        UPDATE public.debts SET amount = v_new_total
            WHERE receipt_id = p_receipt_id AND status <> 'paid';
        v_debt_updated := FOUND;
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
        INSERT INTO public.audit_logs (business_id, user_email, action, receipt_id, details)
        VALUES (
            v_receipt.business_id, public.current_actor_label(v_receipt.business_id), 'MODIFY_SALE', p_receipt_id,
            jsonb_build_object('changes', v_changes, 'old_total', v_old_total, 'new_total', v_new_total,
                               'debt_updated', v_debt_updated)
        );
    END IF;

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.modify_sale(uuid, jsonb) TO authenticated;
