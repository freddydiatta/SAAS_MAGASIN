-- ==========================================
-- TRAÇABILITÉ DES CONNEXIONS — à exécuter dans l'éditeur SQL de Supabase.
--
-- Le journal d'authentification natif de Supabase (auth.audit_log_entries)
-- s'est révélé vide sur ce projet : le stockage en base de ces logs est
-- désactivé par défaut côté plateforme (seul le dashboard les garde, sauf
-- activation manuelle du réglage "Audit Logs" dans Authentication >
-- Configuration). On ne peut donc pas s'appuyer dessus de façon fiable.
--
-- Ce script ajoute deux fonctions qui écrivent directement dans la table
-- audit_logs déjà existante (RLS : insertion par les membres, lecture par
-- le propriétaire seul, cf. 2026-08-21_audit_logs_owner_only.sql) :
--   - log_login_success() : à appeler juste après une connexion réussie
--     (propriétaire OU caissier), journalise pour chaque commerce concerné.
--   - log_failed_login(email) : à appeler après un échec de connexion
--     propriétaire (mauvais mot de passe). Ne révèle jamais si l'email
--     correspond à un compte existant (retourne silencieusement si non).
-- Les échecs de code PIN caissier sont journalisés côté Edge Function
-- cashier-login (accès direct à business_id, pas besoin de cette RPC).
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE OR REPLACE FUNCTION public.log_login_success()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_email text;
    v_business RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

    FOR v_business IN
        SELECT b.id, 'owner' AS role FROM public.businesses b WHERE b.user_id = auth.uid()
        UNION ALL
        SELECT bm.business_id, 'cashier' FROM public.business_members bm
            WHERE bm.user_id = auth.uid() AND bm.is_active
    LOOP
        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_business.id, v_email, 'LOGIN_SUCCESS', jsonb_build_object('role', v_business.role));
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.log_login_success() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_login_success() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_login_success() FROM anon;

CREATE OR REPLACE FUNCTION public.log_failed_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_business RECORD;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_business IN SELECT id FROM public.businesses WHERE user_id = v_user_id
    LOOP
        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_business.id, p_email, 'LOGIN_FAILED', jsonb_build_object('role', 'owner'));
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.log_failed_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_failed_login(text) TO authenticated, anon;
