import { supabase } from '../lib/supabase';

// Comptes où l'argent du commerce se trouve réellement : tiroir-caisse, Wave,
// Orange Money... On n'y saisit qu'un point de départ daté ; le solde courant
// est ensuite calculé à partir des encaissements et des dépenses (voir
// useFinances), pour ne pas avoir à le corriger après chaque vente.
export const fetchMoneyAccounts = async (businessId) => {
    const { data, error } = await supabase
        .from('money_accounts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at');
    if (error) throw error;
    return data || [];
};

export const addMoneyAccount = async ({ businessId, name, kind, openingBalance }) => {
    const { error } = await supabase.from('money_accounts').insert([{
        business_id: businessId,
        name,
        kind,
        opening_balance: openingBalance,
    }]);
    if (error) throw error;
};

// Corriger le point de départ le redate à maintenant : le montant saisi
// décrit ce qu'on a en main à cet instant, donc les mouvements ne comptent
// qu'à partir de là — sinon les ventes déjà passées seraient comptées deux
// fois, une fois dans le montant saisi et une fois dans l'historique.
export const updateMoneyAccount = async ({ id, name, kind, openingBalance }) => {
    const { error } = await supabase
        .from('money_accounts')
        .update({ name, kind, opening_balance: openingBalance, opening_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
};

export const deleteMoneyAccount = async (id) => {
    const { error } = await supabase.from('money_accounts').delete().eq('id', id);
    if (error) throw error;
    return id;
};
