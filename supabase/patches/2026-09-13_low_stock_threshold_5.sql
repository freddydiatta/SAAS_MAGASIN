-- Seuil d'alerte de stock bas relevé de 2 à 5 : prévenir à 2 unités laisse
-- rarement le temps de se réapprovisionner avant la rupture, surtout sur les
-- références qui partent vite.
--
-- Le seuil vit à deux endroits qui doivent rester d'accord : ici pour la
-- notification push envoyée au moment de la vente, et LOW_STOCK_THRESHOLD
-- dans src/hooks/useRetailDashboardStats.js pour la carte "Alertes Stock".
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
    v_new_stock integer;
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

        -- v_product.cost_price peut être NULL (produit sans prix d'achat
        -- renseigné) : total_cost reste alors NULL, traité comme "coût
        -- inconnu" côté Finances plutôt que compté comme un coût de 0.
        INSERT INTO public.sales (business_id, receipt_id, product_id, quantity, total_price, total_cost)
        VALUES (p_business_id, v_receipt.id, v_product.id, v_qty, v_product.price * v_qty, v_product.cost_price * v_qty);

        v_new_stock := v_product.stock_quantity - v_qty;
        UPDATE public.products SET stock_quantity = v_new_stock WHERE id = v_product.id;

        -- Uniquement au franchissement du seuil, pas à chaque vente en
        -- dessous : sinon chaque vente d'un produit déjà bas renverrait la
        -- même alerte, et on finirait par ne plus les lire.
        IF v_product.stock_quantity > 5 AND v_new_stock <= 5 THEN
            PERFORM public.notify_low_stock(p_business_id, v_product.name, v_new_stock);
        END IF;
    END LOOP;

    RETURN v_receipt;
END;
$$;
