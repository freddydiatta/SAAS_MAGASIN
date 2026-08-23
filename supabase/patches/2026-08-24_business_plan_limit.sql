-- ==========================================
-- LIMITE DE MAGASINS PAR FORFAIT
-- Le forfait Essentiel (5000 FCFA/mois) est limité à 1 magasin ; le
-- forfait Business (9000 FCFA/mois) permet d'en créer autant que voulu.
-- L'UI (BusinessList.jsx) empêche déjà d'atteindre le formulaire de
-- création une fois la limite atteinte, mais rien n'empêchait un appel
-- direct à l'API Supabase de la contourner — ce trigger l'impose aussi
-- côté base.
-- ==========================================

CREATE OR REPLACE FUNCTION public.enforce_business_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan text;
    v_existing_count integer;
BEGIN
    SELECT COALESCE(raw_user_meta_data->>'subscription_plan', 'essentiel')
    INTO v_plan
    FROM auth.users
    WHERE id = NEW.user_id;

    IF v_plan IS DISTINCT FROM 'business' THEN
        SELECT COUNT(*) INTO v_existing_count
        FROM public.businesses
        WHERE user_id = NEW.user_id;

        IF v_existing_count >= 1 THEN
            RAISE EXCEPTION 'Le forfait Essentiel est limité à 1 magasin. Passez au forfait Business pour en créer davantage.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_business_plan_limit ON public.businesses;
CREATE TRIGGER trg_enforce_business_plan_limit
BEFORE INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.enforce_business_plan_limit();
