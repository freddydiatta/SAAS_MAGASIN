-- Le chiffre d'affaires total repart de ce que le commerce avait déjà gagné
-- avant d'utiliser l'application : le solde déclaré sur ses comptes le
-- premier jour. Ce montant doit rester figé.
--
-- opening_balance / opening_at, eux, bougent : redéclarer un solde les
-- redate à maintenant (voir updateMoneyAccount), et ajouter un deuxième
-- compte sur un même moyen de paiement décalait aussi la frontière du
-- groupe. Le chiffre d'affaires se mettait alors à baisser tout seul, alors
-- qu'aucune vente n'avait disparu.
--
-- initial_balance garde la toute première déclaration ; created_at en donne
-- la date et n'est jamais modifié.

alter table public.money_accounts
    add column if not exists initial_balance numeric(12, 2) not null default 0;

-- Reprise des comptes existants : tant qu'un compte n'a jamais été
-- redéclaré (opening_at est resté égal à created_at), son solde d'ouverture
-- actuel EST sa première déclaration. Rejouer ce patch ne touchera donc pas
-- aux comptes corrigés depuis.
update public.money_accounts
set initial_balance = opening_balance
where opening_at = created_at;

comment on column public.money_accounts.initial_balance is
    'Tout premier solde déclaré, à la création du compte. Sert au chiffre d''affaires total (ce que le commerce avait gagné avant l''application) et ne doit jamais être modifié ensuite, contrairement à opening_balance.';
