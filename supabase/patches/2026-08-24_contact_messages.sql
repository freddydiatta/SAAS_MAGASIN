-- ==========================================
-- MESSAGES DE CONTACT (site public) — à exécuter dans l'éditeur SQL de
-- Supabase.
--
-- Jusqu'ici, la modale "Nous contacter" du site simulait juste l'envoi
-- (setTimeout, aucune donnée nulle part) — et le bouton du footer n'était
-- même pas branché dessus. Cette table stocke les messages envoyés depuis
-- le nouveau formulaire public (voir Edge Function send-contact-message),
-- qui insère via service_role : aucune policy INSERT/SELECT pour
-- anon/authenticated n'est nécessaire, ces messages ne sont consultables
-- que depuis le tableau de bord Supabase (Table Editor).
-- Idempotent : peut être rejoué sans risque.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
