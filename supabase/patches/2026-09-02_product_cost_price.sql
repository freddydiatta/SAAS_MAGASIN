-- ==========================================
-- PRIX D'ACHAT / MARGE PAR PRODUIT
-- Première étape du suivi fournisseurs : avant de gérer des fiches
-- fournisseur et des bons de commande, on permet déjà de saisir un prix
-- d'achat par produit pour que le Stock affiche la marge (prix de vente -
-- prix d'achat). Nullable : un produit existant sans prix d'achat renseigné
-- reste valide, la marge s'affiche juste comme non disponible.
-- ==========================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) CHECK (cost_price >= 0);
