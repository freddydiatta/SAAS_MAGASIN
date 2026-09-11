import { supabase } from '../lib/supabase';

// Comptes où l'argent du commerce se trouve réellement : tiroir-caisse, Wave,
// Orange Money... Ce sont des soldes saisis à la main, à recouper avec ce que
// l'application a calculé (voir la répartition des encaissements dans
// Finances) — pas un grand livre de mouvements.
export const fetchMoneyAccounts = async (businessId) => {
    const { data, error } = await supabase
        .from('money_accounts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at');
    if (error) throw error;
    return data || [];
};

export const addMoneyAccount = async ({ businessId, name, kind, balance }) => {
    const { error } = await supabase.from('money_accounts').insert([{
        business_id: businessId,
        name,
        kind,
        balance,
    }]);
    if (error) throw error;
};

// updated_at est réécrit à chaque correction : un solde daté d'il y a trois
// jours ne vaut rien pour compter la caisse ce soir, autant que ça se voie.
export const updateMoneyAccount = async ({ id, name, kind, balance }) => {
    const { error } = await supabase
        .from('money_accounts')
        .update({ name, kind, balance, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
};

export const deleteMoneyAccount = async (id) => {
    const { error } = await supabase.from('money_accounts').delete().eq('id', id);
    if (error) throw error;
    return id;
};
