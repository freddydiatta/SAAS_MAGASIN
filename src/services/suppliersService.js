import { supabase } from '../lib/supabase';

export const fetchSuppliers = async (businessId) => {
    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
    if (error) throw error;
    return data;
};

export const addSupplier = async ({ businessId, name, contactName, phone, email }) => {
    const { error } = await supabase.from('suppliers').insert([{
        business_id: businessId,
        name,
        contact_name: contactName || null,
        phone: phone || null,
        email: email || null,
    }]);
    if (error) throw error;
};

export const deleteSupplier = async (id) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    return id;
};
