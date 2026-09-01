-- ==========================================
-- VERROUILLAGE ANTI BRUTE-FORCE : CONNEXION PROPRIÉTAIRE
-- Le blocage après 5 tentatives (Login.jsx) était uniquement un compteur
-- React côté client — contournable en rafraîchissant la page, ou
-- totalement ignoré par un script appelant directement l'API Supabase.
-- Ce compteur vit désormais en base et est vérifié/mis à jour de façon
-- atomique (FOR UPDATE), sur le même modèle que record_pin_attempt pour
-- les caissiers.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
    email TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- Aucune policy anon/authenticated : accessible uniquement via la fonction
-- SECURITY DEFINER ci-dessous, elle-même appelée uniquement depuis
-- l'Edge Function owner-login (service_role) — jamais en lecture/écriture
-- directe, sinon n'importe qui pourrait verrouiller le compte de
-- n'importe qui juste en connaissant son email (déni de service), sans
-- jamais avoir besoin de deviner son mot de passe.

CREATE OR REPLACE FUNCTION public.record_login_attempt(p_email text, p_success boolean)
RETURNS TABLE(failed_attempts integer, locked_until timestamptz, is_locked boolean, just_locked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_email text := lower(trim(p_email));
    v_current public.login_attempts%ROWTYPE;
    v_new_attempts integer;
    v_new_locked_until timestamptz;
BEGIN
    INSERT INTO public.login_attempts (email) VALUES (v_email)
    ON CONFLICT (email) DO NOTHING;

    SELECT * INTO v_current FROM public.login_attempts WHERE email = v_email FOR UPDATE;

    IF v_current.locked_until IS NOT NULL AND v_current.locked_until > now() THEN
        RETURN QUERY SELECT v_current.failed_attempts, v_current.locked_until, true, false;
        RETURN;
    END IF;

    IF p_success THEN
        UPDATE public.login_attempts
        SET failed_attempts = 0, locked_until = NULL, updated_at = now()
        WHERE email = v_email;
        RETURN QUERY SELECT 0, NULL::timestamptz, false, false;
        RETURN;
    END IF;

    v_new_attempts := COALESCE(v_current.failed_attempts, 0) + 1;
    IF v_new_attempts >= 5 THEN
        v_new_locked_until := now() + interval '15 minutes';
        v_new_attempts := 0;
    ELSE
        v_new_locked_until := NULL;
    END IF;

    UPDATE public.login_attempts
    SET failed_attempts = v_new_attempts, locked_until = v_new_locked_until, updated_at = now()
    WHERE email = v_email;

    RETURN QUERY SELECT v_new_attempts, v_new_locked_until, (v_new_locked_until IS NOT NULL), (v_new_locked_until IS NOT NULL);
END;
$$;

-- REVOKE ALL FROM PUBLIC ne suffit pas : Supabase accorde automatiquement
-- EXECUTE à anon/authenticated indépendamment de PUBLIC sur toute nouvelle
-- fonction (cf. record_pin_attempt un peu plus haut dans ce fichier).
REVOKE ALL ON FUNCTION public.record_login_attempt(text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_login_attempt(text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_login_attempt(text, boolean) FROM authenticated;
