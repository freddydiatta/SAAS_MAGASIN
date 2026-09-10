-- ==========================================
-- CODE-BARRES PRODUIT (scan caméra téléphone)
-- Permet de retrouver un produit en scannant son code-barres fabricant
-- (déjà imprimé sur la plupart des boissons/emballages) plutôt que de le
-- chercher par nom — utilisé en Caisse (ajout rapide au panier) et en
-- Inventaires (comptage scan -> quantité -> suivant, comme les agences
-- d'inventaire physiques). Optionnel : un produit sans code-barres reste
-- utilisable normalement, juste non trouvable par scan.
-- ==========================================

ALTER TABLE public.products ADD COLUMN barcode TEXT;

-- Unique par commerce (pas globalement) : deux commerces différents
-- peuvent légitimement vendre le même article de grande marque et donc
-- scanner le même code-barres fabricant. NULL autorisé en plusieurs
-- exemplaires (produits sans code-barres) — un index unique partiel
-- l'exclut du contrôle d'unicité.
CREATE UNIQUE INDEX idx_products_business_barcode
    ON public.products (business_id, barcode)
    WHERE barcode IS NOT NULL;
