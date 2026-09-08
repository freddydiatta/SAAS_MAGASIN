-- Relie une dette née d'une vente à crédit (Caisse.jsx) au reçu d'origine,
-- pour pouvoir afficher les articles concernés dans Dettes.jsx plutôt que
-- juste le montant total. NULL pour une dette saisie manuellement (prêt
-- sans vente associée) — reste valide, juste sans détail d'articles.
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL;
