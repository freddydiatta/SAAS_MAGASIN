import { supabase } from '../lib/supabase';
import { deleteProductImage } from './imagesService';

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

export const addProduct = async ({ businessId, name, type, price, costPrice, supplierId, stockQuantity, imageUrl }) => {
    const { error } = await supabase.from('products').insert([{
        business_id: businessId,
        name,
        type,
        price,
        cost_price: costPrice ?? null,
        supplier_id: supplierId || null,
        stock_quantity: stockQuantity,
        image_url: imageUrl || null,
    }]);
    if (error) throw error;
};

export const updateProduct = async ({ id, name, type, price, costPrice, supplierId, stockQuantity, imageUrl, previousImageUrl }) => {
    const { error } = await supabase
        .from('products')
        .update({ name, type, price, cost_price: costPrice ?? null, supplier_id: supplierId || null, stock_quantity: stockQuantity, image_url: imageUrl || null })
        .eq('id', id);
    if (error) throw error;

    // Best-effort : ne fait jamais échouer la mise à jour du produit
    // elle-même si le nettoyage de l'ancienne photo dans Storage échoue.
    if (previousImageUrl && previousImageUrl !== imageUrl) {
        deleteProductImage(previousImageUrl).catch((e) =>
            console.error('Impossible de supprimer l\'ancienne photo du produit:', e.message)
        );
    }
};

export const deleteProduct = async ({ id, imageUrl }) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    if (imageUrl) {
        deleteProductImage(imageUrl).catch((e) =>
            console.error('Impossible de supprimer la photo du produit:', e.message)
        );
    }

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
