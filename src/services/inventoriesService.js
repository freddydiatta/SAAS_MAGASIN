import { supabase } from '../lib/supabase';

export const fetchInventories = async (businessId) => {
    const { data, error } = await supabase
        .from('inventories')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const fetchInventoryItems = async (inventoryId) => {
    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('product_name');
    if (error) throw error;
    return data;
};

// Fige le stock théorique de chaque produit dans une nouvelle ligne
// d'inventory_items (voir start_inventory) — le point de départ du
// comptage. L'auteur (created_by) est dérivé côté serveur depuis auth.uid()
// (current_actor_label), jamais envoyé par le client (audit de sécurité du
// 2026-09-10).
export const startInventory = async ({ businessId, note }) => {
    const { data, error } = await supabase.rpc('start_inventory', {
        p_business_id: businessId,
        p_note: note || null,
    });
    if (error) throw error;
    return data;
};

const updateInventoryItemCount = async (itemId, countedQuantity) => {
    const { error } = await supabase
        .from('inventory_items')
        .update({ counted_quantity: countedQuantity })
        .eq('id', itemId);
    if (error) throw error;
};

// Enregistre les comptages saisis (simple donnée, pas d'effet de bord tant
// que l'inventaire n'est pas validé) — un article à la fois puisqu'il n'y a
// pas d'upsert en masse pratique ici, mais en parallèle.
export const saveInventoryCounts = async (items) => {
    await Promise.all(items.map((item) => updateInventoryItemCount(item.id, item.countedQuantity)));
};

// Applique les comptages comme nouveau stock (voir validate_inventory) —
// journalisée, refuse un inventaire déjà validé ou sans aucun article
// compté.
export const validateInventory = async ({ inventoryId }) => {
    const { data, error } = await supabase.rpc('validate_inventory', {
        p_inventory_id: inventoryId,
    });
    if (error) throw error;
    return data;
};

// Un inventaire validé a déjà corrigé le stock : seul un brouillon peut
// être supprimé sans rien laisser d'intraçable derrière lui.
export const deleteInventory = async (id) => {
    const { error } = await supabase
        .from('inventories')
        .delete()
        .eq('id', id)
        .eq('status', 'draft');
    if (error) throw error;
    return id;
};
