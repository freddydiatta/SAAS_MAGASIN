-- Suppression d'un magasin en deux temps : supprimer un commerce efface en
-- cascade tout ce qu'il contient (produits, ventes, reçus, dettes,
-- inventaires, fournisseurs, journal...). Faire partir tout ça sur un simple
-- clic, sans retour possible, est trop dangereux pour une vraie boutique.
--
-- deleted_at marque donc le magasin comme supprimé : il disparaît tout de
-- suite de l'application, mais reste restaurable pendant 7 jours. Passé ce
-- délai, purge_deleted_businesses() le supprime pour de bon — et le CASCADE
-- des tables liées emporte alors réellement toutes ses données.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Index partiel : la purge ne s'intéresse qu'aux quelques lignes supprimées,
-- jamais aux commerces actifs (l'immense majorité de la table).
CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at
    ON public.businesses (deleted_at) WHERE deleted_at IS NOT NULL;

-- SECURITY DEFINER : tourne de nuit via pg_cron, hors session utilisateur,
-- donc sans contexte RLS. Le délai de 7 jours vit ici, en un seul endroit.
CREATE OR REPLACE FUNCTION public.purge_deleted_businesses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_purged integer;
BEGIN
    DELETE FROM public.businesses
    WHERE deleted_at IS NOT NULL
      AND deleted_at < timezone('utc'::text, now()) - interval '7 days';
    GET DIAGNOSTICS v_purged = ROW_COUNT;
    RETURN v_purged;
END;
$$;

-- Postgres accorde EXECUTE à PUBLIC par défaut : sans ce REVOKE, n'importe
-- quel utilisateur connecté pourrait déclencher la purge (d'un compte qui
-- n'est pas le sien, qui plus est, la fonction étant SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.purge_deleted_businesses() FROM PUBLIC;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Chaque nuit à 3h UTC. Re-planifier sous le même nom remplace le job
-- existant, donc ce script reste rejouable.
SELECT cron.schedule(
    'purge-deleted-businesses',
    '0 3 * * *',
    $cron$SELECT public.purge_deleted_businesses()$cron$
);
