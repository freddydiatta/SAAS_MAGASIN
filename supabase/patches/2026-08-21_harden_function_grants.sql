-- ==========================================
-- DURCISSEMENT SÉCURITÉ — à exécuter dans l'éditeur SQL de Supabase
-- Fait suite aux avertissements remontés par l'audit sécurité Supabase
-- (get_advisors) après l'application de 2026-08-21_critical_fixes.sql :
--   - "Function Search Path Mutable" sur les 5 fonctions
--   - "Public Can Execute SECURITY DEFINER Function" sur register_referral
--     (exécutable par un utilisateur anonyme, non prévu)
-- Sans danger : ne change pas le comportement de l'application, qui
-- n'appelle déjà ces fonctions que depuis un utilisateur authentifié.
-- ==========================================

ALTER FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_sale(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.modify_sale(uuid, text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.adjust_stock(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.register_referral(text) SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_sale(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.modify_sale(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_referral(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modify_sale(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_referral(text) TO authenticated;

-- Supabase accorde automatiquement EXECUTE au rôle "anon" (utilisateur non
-- connecté) sur toute nouvelle fonction du schéma public — indépendamment
-- de PUBLIC. Le REVOKE ALL FROM PUBLIC ci-dessus ne suffit donc pas : il
-- faut retirer explicitement le droit "anon" (constaté via get_advisors
-- après une première exécution de ce script).
REVOKE EXECUTE ON FUNCTION public.process_sale(uuid, text, text, text, jsonb, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.modify_sale(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_referral(text) FROM anon;
