import { supabase } from '../lib/supabase';

export const fetchDebts = async (businessId) => {
    const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const addDebt = async ({ businessId, customerName, customerPhone, amount, note }) => {
    const { error } = await supabase.from('debts').insert([{
        business_id: businessId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        amount,
        note: note || null,
    }]);
    if (error) throw error;
};

export const markDebtPaid = async (id) => {
    const { error } = await supabase
        .from('debts')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteDebt = async (id) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw error;
    return id;
};
