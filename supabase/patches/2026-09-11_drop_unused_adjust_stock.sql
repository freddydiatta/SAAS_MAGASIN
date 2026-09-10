-- ==========================================
-- SUPPRESSION DE adjust_stock (RPC mort, faille de traçabilité résiduelle)
-- Le frontend n'appelle plus adjust_stock depuis que les +/- à main levée
-- ont été retirés de Stock.jsx/Motos.jsx (le stock ne bouge plus que par
-- une vente, un bon de commande reçu ou un inventaire validé — toujours
-- journalisé). Mais la fonction restait GRANTée à `authenticated` et
-- restait donc appelable directement via l'API par n'importe quel membre
-- d'un commerce pour modifier SON PROPRE stock sans aucune trace dans
-- audit_logs — un trou résiduel dans la garantie "le stock ne se modifie
-- que de façon tracée" tant qu'elle restait joignable, indépendamment de
-- ce que fait l'interface. Trouvé lors de l'audit de sécurité du
-- 2026-09-11 (aucune autre fonction RPC de l'application n'a d'équivalent
-- non tracé).
-- ==========================================

DROP FUNCTION IF EXISTS public.adjust_stock(uuid, integer);
