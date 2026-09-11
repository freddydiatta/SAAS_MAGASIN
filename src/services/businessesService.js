import { supabase } from '../lib/supabase';

// Nombre de jours pendant lesquels un magasin supprimé reste récupérable.
// Doit rester aligné sur l'intervalle de purge_deleted_businesses() côté base
// (voir supabase/patches/2026-09-11_business_soft_delete.sql) : ici ça ne sert
// qu'à afficher le temps restant, c'est la base qui fait foi sur la purge.
export const BUSINESS_RETENTION_DAYS = 7;

// Supprimer un magasin efface en cascade tout ce qu'il contient : on marque
// donc d'abord la ligne comme supprimée (elle disparaît de l'app) et c'est la
// purge nocturne qui tranche définitivement, 7 jours plus tard. La RLS
// ("Users can manage their own businesses") réserve déjà cette écriture au
// propriétaire : un caissier n'a qu'un droit de lecture sur son commerce.
export const softDeleteBusiness = async (id) => {
    const { error } = await supabase
        .from('businesses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
    return id;
};

export const restoreBusiness = async (id) => {
    const { error } = await supabase
        .from('businesses')
        .update({ deleted_at: null })
        .eq('id', id);
    if (error) throw error;
    return id;
};

export const fetchDeletedBusinesses = async () => {
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

// Jours restants avant la purge définitive, arrondis au supérieur pour ne
// jamais promettre plus de temps qu'il n'en reste réellement. 0 = le magasin
// part à la prochaine purge.
export const daysBeforePurge = (deletedAt, now = new Date()) => {
    const elapsedMs = now.getTime() - new Date(deletedAt).getTime();
    const remainingMs = BUSINESS_RETENTION_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
    return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
};
