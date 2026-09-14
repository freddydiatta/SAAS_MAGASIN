-- ==========================================
-- FACTURE FOURNISSEUR SUR LE BON DE COMMANDE
--
-- À la livraison, le fournisseur remet une facture papier. Sans elle attachée
-- au bon, il ne reste aucune trace de ce qui a réellement été livré ni à quel
-- prix : en cas de litige (quantité manquante, prix différent de la commande),
-- le commerçant n'a que sa mémoire. La réception est donc refusée tant que la
-- facture n'est pas jointe — c'est le seul moment où elle est en main.
--
-- Le fichier vit dans un bucket PRIVÉ, contrairement aux photos de produits :
-- une facture porte les prix d'achat et l'identité du fournisseur, ce n'est
-- pas une vitrine. La lecture passe par une URL signée à durée limitée.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS invoice_path TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS invoice_file_name TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS invoice_uploaded_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.purchase_orders.invoice_path IS
    'Chemin du fichier dans le bucket privé purchase-order-invoices. On stocke le chemin et non une URL : l''accès se fait par URL signée, régénérée à chaque consultation.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'purchase-order-invoices',
    'purchase-order-invoices',
    false,
    10485760, -- 10 Mo : une photo de facture non redimensionnée peut être lourde
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Business members can read their purchase order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Business members can upload their purchase order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Business members can update their purchase order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Business members can delete their purchase order invoices" ON storage.objects;

-- Convention de chemin : purchase-order-invoices/<business_id>/<order_id>/<fichier>
-- Le premier segment doit être l'id du commerce, comme pour product-images.
-- Pas de policy de lecture publique ici : seuls les membres du commerce
-- peuvent lire, et c'est cette policy qui autorise la création d'URL signées.
CREATE POLICY "Business members can read their purchase order invoices"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'purchase-order-invoices'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Business members can upload their purchase order invoices"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'purchase-order-invoices'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Business members can update their purchase order invoices"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'purchase-order-invoices'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Business members can delete their purchase order invoices"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'purchase-order-invoices'
    AND public.is_business_member((storage.foldername(name))[1]::uuid)
);

-- La réception exige désormais la facture. Le contrôle est côté base et pas
-- seulement dans l'interface : c'est elle qui fait foi, y compris pour une
-- réception rejouée depuis la file hors-ligne.
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
    IF v_order.invoice_path IS NULL THEN
        RAISE EXCEPTION 'Joignez la facture du fournisseur avant de valider la réception.';
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
        -- L'argent sort à la réception : c'est ici qu'on sait de quel solde
        -- il faut le retirer (voir useFinances).
        payment_method = p_payment_method
    WHERE id = p_purchase_order_id;

    SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, text) TO authenticated;
