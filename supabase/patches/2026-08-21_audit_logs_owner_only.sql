-- ==========================================
-- LOGS DE SÉCURITÉ RÉSERVÉS AU PROPRIÉTAIRE — à exécuter dans l'éditeur SQL
-- de Supabase.
-- Jusqu'ici, la policy "FOR ALL USING (is_business_member(...))" sur
-- audit_logs permettait à N'IMPORTE QUEL membre (donc un caissier) de :
--   - LIRE tout le journal (annulations/modifications de ventes)
--   - le MODIFIER ou le SUPPRIMER (aucune policy UPDATE/DELETE dédiée,
--     donc couvert par le "ALL" du même coup)
-- Ce script restreint la lecture au propriétaire uniquement, et rend le
-- journal immuable (aucune policy UPDATE/DELETE = personne ne peut
-- modifier ou effacer une entrée via l'API, seule l'insertion reste
-- ouverte aux membres pour qu'ils puissent logger leurs propres actions).
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

DROP POLICY IF EXISTS "Users can view and insert audit logs of their businesses" ON public.audit_logs;
DROP POLICY IF EXISTS "Members can view and insert audit logs of their businesses" ON public.audit_logs;
DROP POLICY IF EXISTS "Members can insert audit logs of their businesses" ON public.audit_logs;
DROP POLICY IF EXISTS "Owner can view audit logs of their business" ON public.audit_logs;

CREATE POLICY "Members can insert audit logs of their businesses"
ON public.audit_logs
FOR INSERT WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "Owner can view audit logs of their business"
ON public.audit_logs
FOR SELECT USING (public.is_business_owner(business_id));
