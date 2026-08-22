-- ==========================================
-- STATUT DE PARRAINAGE CORRIGÉ — à exécuter dans l'éditeur SQL de Supabase.
--
-- register_referral marquait un filleul 'active' dès l'inscription, pas à
-- la conversion payante — donc dans AffiliateDashboard.jsx, "Abonnements
-- Actifs" affichait toujours la même valeur que "Inscriptions Totales",
-- peu importe si le filleul payait réellement un abonnement ou non.
--
-- 'active' signifie désormais "a généré au moins une commission" (premier
-- paiement réussi côté filleul) — voir le traitement de commission ajouté
-- dans supabase/functions/paydunya-webhook, qui repasse le statut à
-- 'active' au moment du premier paiement. L'inscription seule marque
-- maintenant 'pending'. Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE OR REPLACE FUNCTION register_referral(ref_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    aff_id uuid;
BEGIN
    SELECT id INTO aff_id FROM public.affiliates WHERE referral_code = ref_code;
    IF aff_id IS NOT NULL THEN
        INSERT INTO public.referrals (affiliate_id, referred_user_id, status)
        VALUES (aff_id, auth.uid(), 'pending')
        ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
END;
$$;
