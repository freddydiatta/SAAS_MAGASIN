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

export const addExpense = async ({ businessId, category, label, amount, createdBy }) => {
    const { error } = await supabase.from('expenses').insert([{
        business_id: businessId,
        category,
        label: label || null,
        amount,
        created_by: createdBy || null,
    }]);
    if (error) throw error;
};

export const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return id;
};
