-- Un solde saisi à la main se périme dès la vente suivante. Ce qu'on veut,
-- c'est déclarer une fois ce qu'on a en caisse et sur Mobile Money, puis
-- laisser l'application suivre : + les encaissements, − les dépenses et les
-- achats de stock. Le montant saisi devient donc un point de départ daté, et
-- non plus un solde courant à corriger sans arrêt.
ALTER TABLE public.money_accounts RENAME COLUMN balance TO opening_balance;
-- Cette colonne portait déjà "depuis quand ce montant est vrai" : c'est
-- exactement la date à partir de laquelle compter les mouvements.
ALTER TABLE public.money_accounts RENAME COLUMN updated_at TO opening_at;

-- Sorties d'argent : jusqu'ici on savait combien était sorti, jamais d'où.
-- Sans ça, impossible de baisser le bon solde — payer un fournisseur par
-- Wave vidait la caisse dans les calculs. NULL = enregistré avant ce choix,
-- moyen réellement inconnu (jamais supposé être des espèces).
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Sur un bon de commande, l'argent sort à la réception, pas à la commande :
-- c'est donc receive_purchase_order qui enregistre le moyen utilisé.
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Ajouter un paramètre crée une surcharge : sans ce DROP, l'ancienne version
-- à un seul argument resterait appelable et enregistrerait une réception
-- sans moyen de paiement.
DROP FUNCTION IF EXISTS public.receive_purchase_order(uuid);

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_purchase_order_id uuid,
    p_payment_method text DEFAULT NULL
)
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
    SET status = 'received',
        received_at = timezone('utc'::text, now()),
        payment_method = p_payment_method
    WHERE id = p_purchase_order_id;

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, text) TO authenticated;
