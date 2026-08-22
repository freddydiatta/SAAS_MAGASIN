-- ==========================================
-- ANTI-SPAM SUR log_failed_login — à exécuter dans l'éditeur SQL de Supabase.
--
-- log_failed_login(email) doit rester accessible à `anon` : elle est
-- appelée depuis Login.jsx AVANT toute authentification, juste après un
-- échec de mot de passe. Mais ça veut dire que n'importe qui peut
-- l'appeler, sans limite, avec n'importe quel email — un script pourrait
-- boucler dessus avec l'email d'un propriétaire connu pour noyer son audit
-- log (owner-only, cf. 2026-08-21_audit_logs_owner_only.sql) sous des
-- milliers de fausses alertes LOGIN_FAILED, jusqu'à masquer une vraie
-- tentative d'intrusion dans le bruit ou simplement gonfler la table.
--
-- On plafonne à une entrée LOGIN_FAILED par commerce toutes les 10
-- secondes : un mot de passe réellement oublié plusieurs fois de suite ne
-- génère qu'une poignée d'entrées, mais un flood automatisé n'en produit
-- plus qu'une par fenêtre de 10s quel que soit le nombre d'appels.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action_created_at
    ON public.audit_logs (business_id, action, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_failed_login(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_business RECORD;
    v_last_logged timestamptz;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_business IN SELECT id FROM public.businesses WHERE user_id = v_user_id
    LOOP
        SELECT MAX(created_at) INTO v_last_logged
        FROM public.audit_logs
        WHERE business_id = v_business.id AND action = 'LOGIN_FAILED';

        IF v_last_logged IS NULL OR v_last_logged < now() - interval '10 seconds' THEN
            INSERT INTO public.audit_logs (business_id, user_email, action, details)
            VALUES (v_business.id, p_email, 'LOGIN_FAILED', jsonb_build_object('role', 'owner'));
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.log_failed_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_failed_login(text) TO authenticated, anon;
