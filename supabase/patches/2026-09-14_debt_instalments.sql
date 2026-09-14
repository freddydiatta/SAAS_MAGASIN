-- ==========================================
-- REMBOURSEMENT D'UNE DETTE PAR TRANCHES
--
-- Jusqu'ici une dette ne pouvait qu'être « remboursée » d'un bloc. Dans la
-- réalité un client doit 10 000 et donne 5 000 aujourd'hui : il fallait soit
-- mentir en la marquant payée, soit ne rien noter et perdre l'avance.
--
-- Chaque versement devient une ligne dans debt_payments, avec son montant, son
-- moyen de paiement et sa date propres. C'est ce qui permet à l'avance de
-- compter dans la caisse le jour où elle est reçue, et non le jour du solde.
-- Le statut de la dette se déduit de la somme des versements.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    -- 'cash' | 'mobile_money' : sans lui, l'argent rentré ne peut pas être
    -- rattaché aux espèces ou au Mobile Money pour recouper la caisse.
    payment_method TEXT,
    -- Date du versement réel, pas de l'enregistrement : une avance reçue
    -- samedi compte samedi, même si elle est saisie lundi (ou synchronisée
    -- depuis la file hors-ligne).
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON public.debt_payments (debt_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_debt_payments_business_id ON public.debt_payments (business_id, paid_at DESC);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage debt payments of their business" ON public.debt_payments;
CREATE POLICY "Members can manage debt payments of their business"
ON public.debt_payments
FOR ALL USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

-- Reprise de l'existant : une dette déjà marquée remboursée doit porter le
-- versement correspondant, sinon son encaissement disparaîtrait des comptes
-- le jour où les finances se baseront sur debt_payments.
INSERT INTO public.debt_payments (debt_id, business_id, amount, payment_method, paid_at)
SELECT d.id, d.business_id, d.amount, d.payment_method, COALESCE(d.paid_at, d.created_at)
FROM public.debts d
WHERE d.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM public.debt_payments p WHERE p.debt_id = d.id);


-- Enregistre un versement et met le statut de la dette à jour. Refuse un
-- montant supérieur à ce qui reste dû : sinon la caisse encaisserait plus que
-- ce que le client devait, sans que rien ne le signale.
CREATE OR REPLACE FUNCTION public.record_debt_payment(
    p_debt_id uuid,
    p_amount numeric,
    p_payment_method text DEFAULT NULL,
    p_paid_at timestamptz DEFAULT NULL,
    p_id uuid DEFAULT NULL
)
RETURNS public.debts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_debt public.debts;
    v_already numeric;
    v_remaining numeric;
    v_paid_at timestamptz := COALESCE(p_paid_at, timezone('utc'::text, now()));
BEGIN
    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dette introuvable';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant du versement doit être supérieur à 0.';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_already
    FROM public.debt_payments WHERE debt_id = p_debt_id;

    v_remaining := v_debt.amount - v_already;
    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'Cette dette est déjà entièrement remboursée.';
    END IF;
    IF p_amount > v_remaining THEN
        RAISE EXCEPTION 'Ce client ne doit plus que % FCFA.', trim(to_char(v_remaining, 'FM999999999990.00'));
    END IF;

    INSERT INTO public.debt_payments (id, debt_id, business_id, amount, payment_method, paid_at, created_by)
    VALUES (
        COALESCE(p_id, gen_random_uuid()),
        p_debt_id,
        v_debt.business_id,
        p_amount,
        p_payment_method,
        v_paid_at,
        public.current_actor_label(v_debt.business_id)
    );

    -- Le statut se déduit des versements : soldée seulement quand le total y
    -- est. payment_method/paid_at sur la dette gardent la trace du DERNIER
    -- versement, pour les écrans qui n'affichent que le solde.
    IF v_already + p_amount >= v_debt.amount THEN
        UPDATE public.debts
        SET status = 'paid', paid_at = v_paid_at, payment_method = p_payment_method
        WHERE id = p_debt_id;
    ELSE
        UPDATE public.debts
        SET status = 'unpaid', paid_at = NULL, payment_method = p_payment_method
        WHERE id = p_debt_id;
    END IF;

    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id;
    RETURN v_debt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_debt_payment(uuid, numeric, text, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(uuid, numeric, text, timestamptz, uuid) TO authenticated;


-- Annuler un versement saisi par erreur. Le statut est recalculé : une dette
-- soldée redevient en cours si on retire une de ses tranches.
CREATE OR REPLACE FUNCTION public.delete_debt_payment(p_payment_id uuid)
RETURNS public.debts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_payment public.debt_payments;
    v_debt public.debts;
    v_total numeric;
    v_last public.debt_payments;
BEGIN
    SELECT * INTO v_payment FROM public.debt_payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Versement introuvable';
    END IF;

    SELECT * INTO v_debt FROM public.debts WHERE id = v_payment.debt_id FOR UPDATE;

    DELETE FROM public.debt_payments WHERE id = p_payment_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM public.debt_payments WHERE debt_id = v_debt.id;

    SELECT * INTO v_last FROM public.debt_payments
    WHERE debt_id = v_debt.id ORDER BY paid_at DESC LIMIT 1;

    UPDATE public.debts
    SET status = CASE WHEN v_total >= v_debt.amount THEN 'paid' ELSE 'unpaid' END,
        paid_at = CASE WHEN v_total >= v_debt.amount THEN v_last.paid_at ELSE NULL END,
        payment_method = v_last.payment_method
    WHERE id = v_debt.id;

    SELECT * INTO v_debt FROM public.debts WHERE id = v_debt.id;
    RETURN v_debt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_debt_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_debt_payment(uuid) TO authenticated;


-- Corriger ou annuler une vente dont la dette a DÉJÀ reçu de l'argent doit
-- rester refusé — jusqu'ici le contrôle ne regardait que le statut 'paid', il
-- laissait donc passer une dette partiellement remboursée, et l'argent déjà
-- encaissé se serait volatilisé avec elle.
CREATE OR REPLACE FUNCTION public.debt_has_payments(p_receipt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.debts d
        JOIN public.debt_payments p ON p.debt_id = d.id
        WHERE d.receipt_id = p_receipt_id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.debt_has_payments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debt_has_payments(uuid) TO authenticated;


-- Les deux fonctions ci-dessous sont reprises telles quelles depuis setup.sql,
-- avec le seul changement decrit plus haut : le controle passe de "dette
-- soldee" a "dette ayant recu le moindre versement" (debt_has_payments).

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

    -- Le moindre versement suffit à bloquer, pas seulement une dette soldée :
    -- depuis les remboursements par tranches, une dette peut avoir déjà reçu
    -- de l'argent tout en restant « unpaid », et cet argent se volatiliserait
    -- avec la dette supprimée ci-dessous.
    IF public.debt_has_payments(p_receipt_id) THEN
        RAISE EXCEPTION 'Cette vente à crédit a déjà reçu un remboursement : elle ne peut plus être annulée.';
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
    -- Idem : un versement déjà encaissé fige la vente, même partiel.
    IF public.debt_has_payments(p_receipt_id) THEN
        RAISE EXCEPTION 'Cette vente à crédit a déjà reçu un remboursement : elle ne peut plus être corrigée.';
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
