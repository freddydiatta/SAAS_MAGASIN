-- ==========================================
-- NOTIFICATIONS PUSH : STOCK BAS
-- Alerte push (navigateur/téléphone) envoyée dès qu'un produit franchit le
-- seuil de stock bas (>2 -> <=2) pendant une vente. process_sale (déjà
-- SECURITY DEFINER) appelle notify_low_stock, qui lit un secret partagé
-- dans Vault (jamais la clé service_role complète) et déclenche l'Edge
-- Function send-push-notification via pg_net — asynchrone, ne bloque jamais
-- la vente si l'envoi échoue (EXCEPTION WHEN OTHERS NULL).
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage push subscriptions of their business" ON public.push_subscriptions;
CREATE POLICY "Members can manage push subscriptions of their business"
    ON public.push_subscriptions
    FOR ALL
    USING (is_business_member(business_id))
    WITH CHECK (is_business_member(business_id));

-- Secret partagé lu par notify_low_stock pour authentifier son appel à
-- send-push-notification (x-push-secret) — jamais exposé côté client, à ne
-- rejouer que si le secret n'existe pas déjà (vault.create_secret n'est pas
-- idempotent par nom).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'push_notify_secret') THEN
        PERFORM vault.create_secret(
            'REPLACE_WITH_THE_SAME_VALUE_AS_THE_PUSH_NOTIFY_SECRET_EDGE_FUNCTION_ENV_VAR',
            'push_notify_secret',
            'Secret partagé HTTP entre notify_low_stock (Postgres) et l''Edge Function send-push-notification.'
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_low_stock(p_business_id uuid, p_product_name text, p_new_stock integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
    v_secret text;
BEGIN
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

-- REVOKE ALL FROM PUBLIC ne suffit pas : Supabase accorde automatiquement
-- EXECUTE à anon/authenticated indépendamment de PUBLIC sur toute nouvelle
-- fonction. notify_low_stock n'est jamais appelée directement par un
-- client (seulement depuis process_sale, appelée par authenticated) — anon
-- n'en a donc pas besoin.
REVOKE ALL ON FUNCTION public.notify_low_stock(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_low_stock(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_low_stock(uuid, text, integer) TO authenticated;

-- process_sale : ajout de la détection de franchissement de seuil de stock
-- bas et de l'appel à notify_low_stock, juste après la mise à jour du
-- stock de chaque ligne vendue.
CREATE OR REPLACE FUNCTION public.process_sale(p_business_id uuid, p_customer_name text, p_customer_phone text, p_payment_method text, p_items jsonb, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS receipts
LANGUAGE plpgsql
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
            RAISE EXCEPTION 'Stock insuffisant pour "%": disponible %, demande %', v_product.name, v_product.stock_quantity, v_qty;
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

        INSERT INTO public.sales (business_id, receipt_id, product_id, quantity, total_price)
        VALUES (p_business_id, v_receipt.id, v_product.id, v_qty, v_product.price * v_qty);

        v_new_stock := v_product.stock_quantity - v_qty;
        UPDATE public.products SET stock_quantity = v_new_stock WHERE id = v_product.id;

        IF v_product.stock_quantity > 2 AND v_new_stock <= 2 THEN
            PERFORM public.notify_low_stock(p_business_id, v_product.name, v_new_stock);
        END IF;
    END LOOP;

    RETURN v_receipt;
END;
$$;
