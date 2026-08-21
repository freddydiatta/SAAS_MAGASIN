-- ==========================================
-- PATCH CRITIQUE — à exécuter dans l'éditeur SQL de Supabase
-- Sans danger sur une base contenant déjà des données :
-- n'utilise que CREATE OR REPLACE FUNCTION et des ALTER TABLE
-- protégés (pas de DROP TABLE, pas de perte de données).
-- ==========================================

-- ------------------------------------------
-- 1. Fonction register_referral corrompue (encodage caractère par
--    caractère dans setup.sql) : réécriture propre.
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.register_referral(ref_code text)
RETURNS void AS $$
DECLARE
    aff_id uuid;
BEGIN
    SELECT id INTO aff_id FROM public.affiliates WHERE referral_code = ref_code;
    IF aff_id IS NOT NULL THEN
        INSERT INTO public.referrals (affiliate_id, referred_user_id, status)
        VALUES (aff_id, auth.uid(), 'active')
        ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_referral(text) TO authenticated;

-- ------------------------------------------
-- 2. Contraintes d'intégrité manquantes (prix/stock/quantités
--    négatifs ou invalides actuellement possibles).
--    Bloc idempotent : peut être rejoué sans erreur si déjà appliqué.
-- ------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT products_price_check CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.products ADD CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.sales ADD CONSTRAINT sales_quantity_check CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.sales ADD CONSTRAINT sales_total_price_check CHECK (total_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.receipts ADD CONSTRAINT receipts_total_amount_check CHECK (total_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.villas ADD CONSTRAINT villas_price_per_night_check CHECK (price_per_night >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_total_price_check CHECK (total_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_price_check CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.restaurant_orders ADD CONSTRAINT restaurant_orders_total_amount_check CHECK (total_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------
-- 3. Vente atomique (création) : remplace le pattern
--    "insert sale puis update stock" fait ligne par ligne côté client
--    (non transactionnel) par une seule fonction Postgres transactionnelle.
--    Verrouille les lignes produit (FOR UPDATE) et vérifie le stock
--    disponible avant d'écrire quoi que ce soit -> empêche la survente
--    en cas de ventes concurrentes, et empêche un état incohérent
--    (reçu créé mais stock non décrémenté) si une étape échoue.
--    Le prix est recalculé depuis la table products (pas depuis le
--    client) pour éviter qu'un total falsifié soit accepté.
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.process_sale(
    p_business_id uuid,
    p_customer_name text,
    p_customer_phone text,
    p_payment_method text,
    p_items jsonb, -- [{ "product_id": uuid, "quantity": int }, ...]
    p_created_at timestamptz DEFAULT NULL -- pour préserver la date d'une vente hors-ligne synchronisée
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
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Le panier est vide';
    END IF;

    -- Passe 1 : verrouille chaque produit et vérifie le stock disponible
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

    -- Création du reçu
    INSERT INTO public.receipts (business_id, customer_name, customer_phone, total_amount, status, payment_method, created_at)
    VALUES (
        p_business_id, p_customer_name, p_customer_phone, v_total, 'completed', p_payment_method,
        COALESCE(p_created_at, timezone('utc'::text, now()))
    )
    RETURNING * INTO v_receipt;

    -- Passe 2 : lignes de vente + décrément du stock (verrouillé plus haut)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;

        INSERT INTO public.sales (business_id, receipt_id, product_id, quantity, total_price)
        VALUES (p_business_id, v_receipt.id, v_product.id, v_qty, v_product.price * v_qty);

        UPDATE public.products SET stock_quantity = stock_quantity - v_qty WHERE id = v_product.id;
    END LOOP;

    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz) TO authenticated;

-- ------------------------------------------
-- 4. Annulation de vente atomique : restaure le stock et journalise
--    l'audit dans la même transaction (remplace la logique dupliquée
--    dans HistoriqueVentes.jsx).
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_sale(
    p_receipt_id uuid,
    p_user_email text
)
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
    VALUES (v_receipt.business_id, p_user_email, 'CANCEL_SALE', p_receipt_id, jsonb_build_object('total_amount', v_receipt.total_amount));

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;

-- ------------------------------------------
-- 5. Modification de vente atomique (remplace la logique dupliquée
--    dans HistoriqueVentes.jsx).
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.modify_sale(
    p_receipt_id uuid,
    p_user_email text,
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
            v_receipt.business_id, p_user_email, 'MODIFY_SALE', p_receipt_id,
            jsonb_build_object('changes', v_changes, 'old_total', v_old_total, 'new_total', v_new_total)
        );
    END IF;

    SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
    RETURN v_receipt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.modify_sale(uuid, text, jsonb) TO authenticated;

-- ------------------------------------------
-- 6. Ajustement de stock atomique (remplace le pattern
--    "lire le stock côté client puis écrire" dans Motos.jsx, sujet
--    à une race condition en cas de clics concurrents).
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_product_id uuid,
    p_change integer
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_product public.products;
BEGIN
    UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity + p_change)
        WHERE id = p_product_id
        RETURNING * INTO v_product;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produit introuvable';
    END IF;

    RETURN v_product;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) TO authenticated;
