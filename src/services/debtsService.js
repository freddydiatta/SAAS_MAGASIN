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

// Modification avec journal d'audit (voir update_debt dans
// supabase/patches/2026-09-08_update_debt_audit.sql) — une correction de
// dette n'est jamais silencieuse.
export const updateDebt = async ({ debtId, userEmail, customerName, customerPhone, amount, note }) => {
    const { data, error } = await supabase.rpc('update_debt', {
        p_debt_id: debtId,
        p_user_email: userEmail,
        p_customer_name: customerName,
        p_customer_phone: customerPhone || null,
        p_amount: amount,
        p_note: note || null,
    });
    if (error) throw error;
    return data;
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
