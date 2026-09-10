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

// Retourne la ligne créée (id inclus) : nécessaire quand un bon de commande
// crée un nouveau produit à la volée (voir useFournisseurs.handleCreateOrder)
// pour connaître l'id à rattacher à la ligne de commande.
export const addProduct = async ({ businessId, name, type, price, costPrice, supplierId, stockQuantity, imageUrl, barcode }) => {
    const { data, error } = await supabase.from('products').insert([{
        business_id: businessId,
        name,
        type,
        price,
        cost_price: costPrice ?? null,
        supplier_id: supplierId || null,
        stock_quantity: stockQuantity,
        image_url: imageUrl || null,
        barcode: barcode || null,
    }]).select().single();
    if (error) throw error;
    return data;
};

export const updateProduct = async ({ id, name, type, price, costPrice, supplierId, stockQuantity, imageUrl, previousImageUrl, barcode }) => {
    const { error } = await supabase
        .from('products')
        .update({ name, type, price, cost_price: costPrice ?? null, supplier_id: supplierId || null, stock_quantity: stockQuantity, image_url: imageUrl || null, barcode: barcode || null })
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
