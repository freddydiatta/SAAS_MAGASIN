import { supabase } from '../lib/supabase';

export const EXPENSE_CATEGORIES = {
    transport: 'Transport',
    loyer: 'Loyer',
    fournitures: 'Fournitures',
    divers: 'Divers',
};

export const fetchExpenses = async (businessId) => {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

// paymentMethod ('cash' | 'mobile_money') : d'où l'argent est sorti. Sans
// lui, une dépense payée par Wave viderait la caisse dans le calcul des
// soldes (voir useFinances).
export const addExpense = async ({ businessId, category, label, amount, paymentMethod, createdBy }) => {
    const { error } = await supabase.from('expenses').insert([{
        business_id: businessId,
        category,
        label: label || null,
        amount,
        payment_method: paymentMethod,
        created_by: createdBy || null,
    }]);
    if (error) throw error;
};

export const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return id;
};
