import { supabase } from '../lib/supabase';

export const listCashiers = async (businessId) => {
    const { data, error } = await supabase
        .from('business_members_safe')
        .select('id, name, role, is_active, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
};

// Crée un vrai compte Supabase Auth pour le caissier (via l'Edge Function
// create-cashier, qui vérifie côté serveur que l'appelant est bien le
// propriétaire du commerce avant de créer quoi que ce soit).
export const createCashier = async ({ businessId, name, pin }) => {
    const { data, error } = await supabase.functions.invoke('create-cashier', {
        body: { business_id: businessId, name, pin },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
};

export const setCashierActive = async ({ id, isActive }) => {
    const { error } = await supabase
        .from('business_members')
        .update({ is_active: isActive })
        .eq('id', id);
    if (error) throw error;
};

// Vérifie le PIN côté serveur (Edge Function cashier-login) et renvoie les
// identifiants du vrai compte du caissier ; le client doit ensuite appeler
// supabase.auth.signInWithPassword() lui-même pour établir la session.
export const cashierLogin = async ({ memberId, pin }) => {
    const { data, error } = await supabase.functions.invoke('cashier-login', {
        body: { member_id: memberId, pin },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data; // { email, password, name }
};
