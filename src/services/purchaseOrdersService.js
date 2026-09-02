import { supabase } from '../lib/supabase';

export const fetchPurchaseOrders = async (businessId) => {
    const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(id, name, contact_name, phone, email), items:purchase_order_items(id, product_id, product_name, quantity, unit_cost)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

// Création atomique du bon + ses lignes côté base (voir create_purchase_order
// dans supabase/patches/2026-09-02_suppliers_and_purchase_orders.sql) — évite
// un bon de commande sans ligne si l'insertion des lignes échouait après
// celle du bon.
export const createPurchaseOrder = async ({ businessId, supplierId, items }) => {
    const { data, error } = await supabase.rpc('create_purchase_order', {
        p_business_id: businessId,
        p_supplier_id: supplierId || null,
        p_items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_cost: item.unitCost,
        })),
    });
    if (error) throw error;
    return data;
};

// Augmente le stock des produits de la commande et marque le bon comme reçu
// (voir receive_purchase_order) — refuse un bon déjà traité.
export const receivePurchaseOrder = async (id) => {
    const { data, error } = await supabase.rpc('receive_purchase_order', { p_purchase_order_id: id });
    if (error) throw error;
    return data;
};

export const cancelPurchaseOrder = async (id) => {
    const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending');
    if (error) throw error;
    return id;
};
