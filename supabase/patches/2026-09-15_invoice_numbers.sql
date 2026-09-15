-- ==========================================
-- NUMÉROTATION DES FACTURES : FAC-2026-00001, FAC-2026-00002...
--
-- Le « numéro » affiché jusqu'ici était le début de l'identifiant technique
-- de la vente (#AFA9BA01) : unique, mais sans ordre. Impossible de savoir
-- combien de factures ont été émises ni s'il en manque une, alors qu'un
-- comptable ou un contrôle attend une suite chronologique sans trou. Et une
-- vente hors-ligne s'imprimait « #TEMP », la même pour toutes.
--
-- Chaque commerce a sa propre suite, qui repart à 1 chaque année (en heure de
-- Dakar). Le numéro est attribué par la base, au moment où la vente est
-- enregistrée, sous verrou : deux caisses ne peuvent pas prendre le même.
--
-- Hors-ligne, l'appareil prend lui-même le numéro qui suit le dernier qu'il
-- connaît, et l'imprime. À la synchronisation, la base l'accepte s'il est
-- bien le suivant. S'il ne l'est plus — un autre appareil a vendu pendant la
-- coupure —, elle attribue le vrai suivant pour garder la suite intacte, et
-- garde la trace du numéro imprimé dans offline_invoice_number.
--
-- Une facture annulée garde son numéro : le réutiliser créerait deux papiers
-- portant le même, le sauter laisserait un trou inexpliqué.
-- ==========================================

ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS offline_invoice_number TEXT;

COMMENT ON COLUMN public.receipts.offline_invoice_number IS
    'Numéro imprimé hors-ligne quand la synchronisation a dû en attribuer un autre (un autre appareil avait vendu pendant la coupure). NULL dans tous les autres cas.';

CREATE UNIQUE INDEX IF NOT EXISTS receipts_invoice_number_unique
    ON public.receipts (business_id, invoice_number)
    WHERE invoice_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.invoice_counters (
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
    PRIMARY KEY (business_id, year)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour les membres : l'appareil a besoin du dernier numéro pour
-- numéroter hors-ligne. Aucune écriture directe — le compteur n'avance que
-- par allocate_invoice_number, d'une unité à la fois.
DROP POLICY IF EXISTS "Members can read invoice counters" ON public.invoice_counters;
CREATE POLICY "Members can read invoice counters"
ON public.invoice_counters
FOR SELECT USING (public.is_business_member(business_id));

CREATE OR REPLACE FUNCTION public.format_invoice_number(p_year integer, p_number integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    -- lpad tronque au-delà de sa longueur : au-delà de 99 999 factures dans
    -- l'année, on écrit le nombre entier plutôt que de le couper.
    SELECT 'FAC-' || p_year || '-' ||
        CASE WHEN p_number > 99999 THEN p_number::text ELSE lpad(p_number::text, 5, '0') END;
$$;

-- Prend le numéro suivant du commerce pour l'année de la vente. Le verrou sur
-- la ligne du compteur sérialise les ventes simultanées : chacune attend que
-- la précédente ait pris le sien.
CREATE OR REPLACE FUNCTION public.allocate_invoice_number(p_business_id uuid, p_at timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year integer := extract(year FROM p_at AT TIME ZONE 'Africa/Dakar')::integer;
    v_next integer;
BEGIN
    IF NOT public.is_business_member(p_business_id) THEN
        RAISE EXCEPTION 'Accès refusé';
    END IF;

    INSERT INTO public.invoice_counters (business_id, year, last_number)
    VALUES (p_business_id, v_year, 0)
    ON CONFLICT (business_id, year) DO NOTHING;

    UPDATE public.invoice_counters
    SET last_number = last_number + 1
    WHERE business_id = p_business_id AND year = v_year
    RETURNING last_number INTO v_next;

    RETURN public.format_invoice_number(v_year, v_next);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.allocate_invoice_number(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(uuid, timestamptz) TO authenticated;

-- Reprise de l'existant : aucune facture n'a encore été remise à un client,
-- toutes les ventes passées reçoivent donc leur numéro, dans l'ordre où elles
-- ont eu lieu. Seules les ventes encore sans numéro sont concernées, et la
-- suite part du compteur existant : rejouer ce patch ne renumérote rien.
WITH numbered AS (
    SELECT
        r.id,
        r.business_id,
        extract(year FROM r.created_at AT TIME ZONE 'Africa/Dakar')::integer AS y,
        row_number() OVER (
            PARTITION BY r.business_id, extract(year FROM r.created_at AT TIME ZONE 'Africa/Dakar')
            ORDER BY r.created_at, r.id
        ) AS n
    FROM public.receipts r
    WHERE r.invoice_number IS NULL
)
UPDATE public.receipts r
-- row_number() est un bigint : converti pour correspondre à format_invoice_number.
SET invoice_number = public.format_invoice_number(numbered.y, (numbered.n + COALESCE(c.last_number, 0))::integer)
FROM numbered
LEFT JOIN public.invoice_counters c ON c.business_id = numbered.business_id AND c.year = numbered.y
WHERE r.id = numbered.id;

INSERT INTO public.invoice_counters (business_id, year, last_number)
SELECT business_id, split_part(invoice_number, '-', 2)::integer, max(split_part(invoice_number, '-', 3)::integer)
FROM public.receipts
WHERE invoice_number LIKE 'FAC-%'
GROUP BY business_id, split_part(invoice_number, '-', 2)::integer
ON CONFLICT (business_id, year) DO UPDATE
SET last_number = GREATEST(public.invoice_counters.last_number, EXCLUDED.last_number);

-- process_sale attribue désormais le numéro. p_invoice_number : celui
-- imprimé hors-ligne, accepté s'il est bien le suivant. Nouveau paramètre =
-- nouvelle signature : l'ancienne doit disparaître, sinon elle resterait
-- appelable et créerait des ventes sans numéro.
DROP FUNCTION IF EXISTS public.process_sale(uuid, text, text, text, jsonb, timestamptz);

CREATE OR REPLACE FUNCTION public.process_sale(
    p_business_id uuid,
    p_customer_name text,
    p_customer_phone text,
    p_payment_method text,
    p_items jsonb, -- [{ "product_id": uuid, "quantity": int }, ...]
    p_created_at timestamptz DEFAULT NULL,
    p_invoice_number text DEFAULT NULL
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
    v_at timestamptz := COALESCE(p_created_at, timezone('utc'::text, now()));
    v_invoice_number text;
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

    -- Numéro attribué seulement une fois le panier validé : une vente refusée
    -- (stock insuffisant) ne consomme pas de numéro, la suite reste sans trou.
    v_invoice_number := public.allocate_invoice_number(p_business_id, v_at);

    INSERT INTO public.receipts (
        business_id, customer_name, customer_phone, total_amount, status, payment_method, created_at,
        invoice_number, offline_invoice_number
    )
    VALUES (
        p_business_id, p_customer_name, p_customer_phone, v_total, 'completed', p_payment_method, v_at,
        v_invoice_number,
        -- Numéro imprimé hors-ligne qui n'était plus le suivant : on le garde
        -- pour pouvoir rapprocher le papier du client de la vente enregistrée.
        CASE WHEN p_invoice_number IS NOT NULL AND p_invoice_number <> v_invoice_number
             THEN p_invoice_number END
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

        -- Notification push au franchissement du seuil de stock bas, et
        -- uniquement là. Le seuil doit rester d'accord avec LOW_STOCK_THRESHOLD
        -- côté application (src/lib/stock.js).
        IF v_product.stock_quantity > 5 AND v_new_stock <= 5 THEN
            PERFORM public.notify_low_stock(p_business_id, v_product.name, v_new_stock);
        END IF;
    END LOOP;

    RETURN v_receipt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz, text) TO authenticated;
