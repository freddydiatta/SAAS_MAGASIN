-- ==========================================
-- VERROU PIN CAISSIER ATOMIQUE — à exécuter dans l'éditeur SQL de Supabase.
--
-- L'Edge Function cashier-login comptait les tentatives de PIN échouées en
-- lisant failed_pin_attempts, en l'incrémentant en JavaScript, puis en
-- réécrivant la valeur — un lire-modifier-écrire non atomique. Plusieurs
-- tentatives envoyées en parallèle lisent toutes la même valeur de départ
-- et réécrivent chacune "+1" à partir de celle-ci : le compteur peut ne
-- jamais atteindre le seuil de verrouillage (5), qui devient contournable
-- par un script envoyant les tentatives en concurrence plutôt qu'en série
-- (un PIN à 4 chiffres n'a que 10 000 combinaisons).
--
-- Cette fonction fait tout en une seule transaction SQL : le SELECT ...
-- FOR UPDATE verrouille la ligne du caissier, donc des appels concurrents
-- se sérialisent au lieu de lire la même valeur en parallèle. Appelée
-- uniquement par cashier-login via le client service_role (qui contourne
-- RLS/grants de toute façon) : pas besoin de l'exposer à anon/authenticated.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE OR REPLACE FUNCTION public.record_pin_attempt(p_member_id uuid, p_success boolean)
RETURNS TABLE(failed_pin_attempts integer, locked_until timestamptz, is_locked boolean, just_locked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current public.business_members%ROWTYPE;
    v_new_attempts integer;
    v_new_locked_until timestamptz;
BEGIN
    SELECT * INTO v_current FROM public.business_members WHERE id = p_member_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Verrouillage déjà actif : on ne recompte rien et on refuse même un
    -- bon PIN tant que la fenêtre de 15 minutes n'est pas écoulée.
    IF v_current.locked_until IS NOT NULL AND v_current.locked_until > now() THEN
        RETURN QUERY SELECT v_current.failed_pin_attempts, v_current.locked_until, true, false;
        RETURN;
    END IF;

    IF p_success THEN
        UPDATE public.business_members
        SET failed_pin_attempts = 0, locked_until = NULL
        WHERE id = p_member_id;
        RETURN QUERY SELECT 0, NULL::timestamptz, false, false;
    ELSE
        v_new_attempts := v_current.failed_pin_attempts + 1;
        IF v_new_attempts >= 5 THEN
            v_new_locked_until := now() + interval '15 minutes';
            v_new_attempts := 0;
        ELSE
            v_new_locked_until := NULL;
        END IF;

        UPDATE public.business_members
        SET failed_pin_attempts = v_new_attempts, locked_until = v_new_locked_until
        WHERE id = p_member_id;

        RETURN QUERY SELECT v_new_attempts, v_new_locked_until, (v_new_locked_until IS NOT NULL), (v_new_locked_until IS NOT NULL);
    END IF;
END;
$$;

-- REVOKE ALL FROM PUBLIC ne suffit pas : Supabase accorde automatiquement
-- EXECUTE à anon/authenticated indépendamment de PUBLIC sur toute nouvelle
-- fonction (constaté à plusieurs reprises sur ce projet). Sans ce second
-- REVOKE, n'importe quel utilisateur connecté aurait pu appeler cette
-- fonction SECURITY DEFINER directement sur l'id de n'importe quel
-- caissier (pas forcément le sien) pour verrouiller/déverrouiller son
-- compte à volonté.
REVOKE ALL ON FUNCTION public.record_pin_attempt(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_pin_attempt(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_pin_attempt(uuid, boolean) FROM authenticated;
