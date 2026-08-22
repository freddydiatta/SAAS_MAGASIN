-- ==========================================
-- ACTIVATION + VERROUILLAGE DE LA TABLE AFFILIATES — à exécuter dans
-- l'éditeur SQL de Supabase.
--
-- Découverte en corrigeant cette faille : les tables affiliates/referrals/
-- commissions n'existaient pas du tout en production (seulement dans
-- setup.sql), alors que la fonction register_referral et la page
-- AffiliateDashboard.jsx les référencent déjà — donc toute inscription via
-- lien de parrainage et toute ouverture de la page "Affiliation"
-- échouaient avec une erreur SQL "relation does not exist". Ce script crée
-- les tables ET corrige la faille RLS d'origine dans la foulée (jamais
-- exposée en prod puisque la table n'existait pas, mais autant ne jamais
-- déployer la version vulnérable).
--
-- La faille : la policy prévue à l'origine ("Users can manage their own
-- affiliate profile", FOR ALL USING (id = auth.uid())) protège la LIGNE
-- (un affilié ne touche que la sienne) mais pas les COLONNES : un affilié
-- aurait pu faire, directement depuis le navigateur :
--   supabase.from('affiliates').update({ commission_rate: 100, total_earnings: 999999999 }).eq('id', user.id)
-- et s'auto-attribuer n'importe quel taux de commission ou montant gagné.
--
-- Corrigé en verrouillant commission_rate/total_earnings au niveau
-- privilège de colonne (Postgres GRANT), pas seulement au niveau ligne
-- (RLS) : ces deux colonnes ne sont accordées en écriture à aucun rôle
-- client, seul un contexte serveur (service_role / une future fonction
-- SECURITY DEFINER de calcul des commissions) pourra les modifier.
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT UNIQUE NOT NULL,
    commission_rate DECIMAL(5, 2) DEFAULT 20.00,
    total_earnings DECIMAL(10, 2) DEFAULT 0.00,
    paypal_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own affiliate profile" ON public.affiliates;
DROP POLICY IF EXISTS "Users can view their own affiliate profile" ON public.affiliates;
DROP POLICY IF EXISTS "Users can create their own affiliate profile" ON public.affiliates;
DROP POLICY IF EXISTS "Users can update their own affiliate profile" ON public.affiliates;

CREATE POLICY "Users can view their own affiliate profile"
ON public.affiliates FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can create their own affiliate profile"
ON public.affiliates FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own affiliate profile"
ON public.affiliates FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

REVOKE ALL ON public.affiliates FROM authenticated;
REVOKE ALL ON public.affiliates FROM anon;
GRANT SELECT ON public.affiliates TO authenticated;
GRANT INSERT (id, referral_code, paypal_email) ON public.affiliates TO authenticated;
GRANT UPDATE (paypal_email) ON public.affiliates TO authenticated;

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(referred_user_id)
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Affiliates can view their referrals" ON public.referrals;
CREATE POLICY "Affiliates can view their referrals"
ON public.referrals FOR SELECT USING (affiliate_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Affiliates can view their commissions" ON public.commissions;
CREATE POLICY "Affiliates can view their commissions"
ON public.commissions FOR SELECT USING (affiliate_id = auth.uid());
