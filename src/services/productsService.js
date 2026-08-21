import { supabase } from '../lib/supabase';

export const productKeys = {
    all: (businessId) => ['products', businessId],
};

export const fetchProducts = async (businessId) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
    if (error) throw error;
    return data;
};

export const addProduct = async ({ businessId, name, type, price, stockQuantity }) => {
    const { error } = await supabase.from('products').insert([{
        business_id: businessId,
        name,
        type,
        price,
        stock_quantity: stockQuantity,
    }]);
    if (error) throw error;
};

export const updateProduct = async ({ id, name, type, price, stockQuantity }) => {
    const { error } = await supabase
        .from('products')
        .update({ name, type, price, stock_quantity: stockQuantity })
        .eq('id', id);
    if (error) throw error;
};

export const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return id;
};

// Ajustement atomique côté base de données (voir adjust_stock dans
// supabase/patches/2026-08-21_critical_fixes.sql) : évite la race condition
// d'un "lire le stock puis écrire" fait depuis le client.
export const adjustStock = async ({ id, change }) => {
    const { data, error } = await supabase.rpc('adjust_stock', {
        p_product_id: id,
        p_change: change,
    });
    if (error) throw error;
    return data;
};
