-- Un remboursement de dette est de l'argent qui rentre, mais jusqu'ici on ne
-- savait pas par quel moyen : Finances et la caisse du jour devaient donc le
-- ranger dans une colonne "moyen non enregistré", séparée des espèces et du
-- Mobile Money. Or c'est justement cette distinction qui permet de recouper
-- la caisse physique en fin de journée — un client qui rembourse 5 000 F en
-- liquide met bien 5 000 F dans le tiroir.
--
-- NULL = dette remboursée avant l'ajout de cette colonne : moyen réellement
-- inconnu, jamais supposé être des espèces (ce qui fausserait le comptage).
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS payment_method TEXT;
