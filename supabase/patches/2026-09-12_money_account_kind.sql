-- Les soldes réels ne vivent pas dans un bloc à part : ils s'affichent en
-- face de ce que l'application a calculé pour le même moyen de paiement
-- (voir "Comment vous avez été payé" dans Finances). Comparer les deux d'un
-- coup d'œil est tout l'intérêt — encore faut-il savoir si un compte est du
-- liquide ou du Mobile Money.
--
-- Par défaut 'cash' : le tiroir-caisse est le cas le plus courant, et c'est
-- aussi le seul choix qui ne fait pas apparaître d'argent sur un compte
-- mobile qui n'existerait pas.
ALTER TABLE public.money_accounts
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'cash';

ALTER TABLE public.money_accounts
    DROP CONSTRAINT IF EXISTS money_accounts_kind_check;
ALTER TABLE public.money_accounts
    ADD CONSTRAINT money_accounts_kind_check CHECK (kind IN ('cash', 'mobile_money'));
