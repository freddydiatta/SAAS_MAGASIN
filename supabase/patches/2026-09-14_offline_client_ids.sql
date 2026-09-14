-- Écritures hors-ligne : accepter un identifiant fourni par le client.
--
-- Une opération mise en file (voir src/services/outbox.js) doit pouvoir être
-- rejouée sans rien réconcilier : si le serveur tire l'identifiant lui-même,
-- le commerçant ne peut pas enchaîner (créer un bon puis le recevoir, démarrer
-- un inventaire puis le compter) tant que le réseau n'est pas revenu, et un
-- rejeu partiel créerait un doublon. Un uuid tiré côté client règle les deux :
-- il est connu tout de suite, et une deuxième tentative bute sur la clé
-- primaire au lieu de créer une seconde ligne.
--
-- Ajouter un paramètre crée une NOUVELLE fonction : l'ancienne signature doit
-- être supprimée explicitement, sinon elle reste appelable (et un client resté
-- sur l'ancienne version continuerait de l'utiliser sans identifiant).

DROP FUNCTION IF EXISTS public.create_purchase_order(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_purchase_order(
    p_business_id uuid,
    p_supplier_id uuid,
    p_items jsonb, -- [{ "product_id": uuid, "quantity": int, "unit_cost": numeric }, ...]
    p_id uuid DEFAULT NULL
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
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Le bon de commande est vide';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        v_unit_cost := (v_item->>'unit_cost')::numeric;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La quantité doit être supérieure à 0';
        END IF;

        SELECT * INTO v_product FROM public.products
            WHERE id = (v_item->>'product_id')::uuid
            AND business_id = p_business_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produit introuvable: %', v_item->>'product_id';
        END IF;

        v_total := v_total + (v_unit_cost * v_qty);
    END LOOP;

    INSERT INTO public.purchase_orders (id, business_id, supplier_id, status, total_amount)
    VALUES (COALESCE(p_id, gen_random_uuid()), p_business_id, p_supplier_id, 'pending', v_total)
    RETURNING * INTO v_order;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::integer;
        v_unit_cost := (v_item->>'unit_cost')::numeric;
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;

        INSERT INTO public.purchase_order_items (purchase_order_id, business_id, product_id, product_name, quantity, unit_cost)
        VALUES (v_order.id, p_business_id, v_product.id, v_product.name, v_qty, v_unit_cost);
    END LOOP;

    RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, jsonb, uuid) TO authenticated;


-- Inventaire : même besoin, plus un second. Hors-ligne, le serveur ne peut pas
-- constituer la liste des articles à compter — c'est l'appareil qui a le
-- catalogue en cache. p_items permet donc de la fournir, avec l'identifiant de
-- chaque ligne, pour que le comptage puisse commencer immédiatement et être
-- rejoué tel quel. Sans p_items, le comportement d'origine est conservé : la
-- liste est dérivée des produits du commerce.
DROP FUNCTION IF EXISTS public.start_inventory(uuid, text);

CREATE OR REPLACE FUNCTION public.start_inventory(
    p_business_id uuid,
    p_note text,
    p_id uuid DEFAULT NULL,
    p_items jsonb DEFAULT NULL -- [{ "id": uuid, "product_id": uuid, "product_name": text, "expected_quantity": int }, ...]
)
RETURNS public.inventories
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_inventory public.inventories;
BEGIN
    INSERT INTO public.inventories (id, business_id, status, note, created_by)
    VALUES (COALESCE(p_id, gen_random_uuid()), p_business_id, 'draft', p_note, public.current_actor_label(p_business_id))
    RETURNING * INTO v_inventory;

    IF p_items IS NULL THEN
        INSERT INTO public.inventory_items (inventory_id, business_id, product_id, product_name, expected_quantity)
        SELECT v_inventory.id, p_business_id, id, name, stock_quantity
        FROM public.products
        WHERE business_id = p_business_id;
    ELSE
        INSERT INTO public.inventory_items (id, inventory_id, business_id, product_id, product_name, expected_quantity)
        SELECT
            COALESCE((item->>'id')::uuid, gen_random_uuid()),
            v_inventory.id,
            p_business_id,
            (item->>'product_id')::uuid,
            item->>'product_name',
            (item->>'expected_quantity')::integer
        FROM jsonb_array_elements(p_items) AS item;
    END IF;

    RETURN v_inventory;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_inventory(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_inventory(uuid, text, uuid, jsonb) TO authenticated;
