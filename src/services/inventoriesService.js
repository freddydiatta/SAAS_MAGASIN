import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, readOutbox, writeOutbox } from './outbox';

export const INVENTORY_START = 'inventory.start';
export const INVENTORY_COUNT = 'inventory.count';
export const INVENTORY_VALIDATE = 'inventory.validate';
export const INVENTORY_DELETE = 'inventory.delete';

export const fetchInventories = async (businessId) => {
    const { data, error } = await supabase
        .from('inventories')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return mergePendingRows(data || [], {
        addKind: INVENTORY_START,
        updateKind: INVENTORY_VALIDATE,
        deleteKind: INVENTORY_DELETE,
        businessId,
    });
};

export const fetchInventoryItems = async (inventoryId) => {
    // Inventaire démarré hors-ligne : ses articles n'existent que dans la
    // file, le serveur n'en sait encore rien. Le comptage doit pourtant
    // pouvoir commencer — c'est même le cas d'usage principal, on compte le
    // stock dans la réserve, là où le réseau passe mal.
    const queuedStart = (await pendingOfKind(INVENTORY_START)).find((e) => e.payload.id === inventoryId);
    if (queuedStart) {
        return mergePendingRows(queuedStart.payload.items, { updateKind: INVENTORY_COUNT });
    }

    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('product_name');
    if (error) throw error;
    return mergePendingRows(data || [], { updateKind: INVENTORY_COUNT });
};

// Fige le stock théorique de chaque produit dans une nouvelle ligne
// d'inventory_items (voir start_inventory) — le point de départ du
// comptage. L'auteur (created_by) est dérivé côté serveur depuis auth.uid()
// (current_actor_label), jamais envoyé par le client (audit de sécurité du
// 2026-09-10).
export const startInventoryRow = async (payload) => {
    const { data, error } = await supabase.rpc('start_inventory', {
        p_business_id: payload.business_id,
        p_note: payload.note || null,
        p_id: payload.id,
        // Hors-ligne, c'est l'appareil qui connaît le catalogue : il fournit
        // la liste à compter, identifiants compris, pour qu'elle soit rejouée
        // à l'identique (voir 2026-09-14_offline_client_ids.sql).
        p_items: payload.items || null,
    });
    if (error) throw error;
    return data;
};

export const startInventory = async ({ businessId, note, products }) => {
    const id = newId();

    if (navigator.onLine) {
        // En ligne, le serveur constitue lui-même la liste depuis les produits :
        // c'est la source la plus fraîche, et rien n'oblige à la transporter.
        return startInventoryRow({ id, business_id: businessId, note });
    }

    if (!products || products.length === 0) {
        throw new Error("Impossible de démarrer un inventaire hors-ligne sans la liste des produits. Ouvrez la page Stock une fois connecté, puis réessayez.");
    }

    const payload = {
        id,
        business_id: businessId,
        note: note || null,
        status: 'draft',
        created_at: new Date().toISOString(),
        items: products.map((product) => ({
            id: newId(),
            inventory_id: id,
            business_id: businessId,
            product_id: product.id,
            product_name: product.name,
            expected_quantity: product.stock_quantity,
            counted_quantity: null,
        })),
    };

    await enqueue({ kind: INVENTORY_START, payload, businessId, label: 'Inventaire démarré' });
    return payload;
};

export const updateInventoryItemCountRow = async ({ id, counted_quantity }) => {
    const { error } = await supabase
        .from('inventory_items')
        .update({ counted_quantity })
        .eq('id', id);
    if (error) throw error;
    return id;
};

// Enregistre les comptages saisis (simple donnée, pas d'effet de bord tant
// que l'inventaire n'est pas validé) — un article à la fois puisqu'il n'y a
// pas d'upsert en masse pratique ici, mais en parallèle.
export const saveInventoryCounts = async (items) => {
    if (navigator.onLine) {
        await Promise.all(items.map((item) =>
            updateInventoryItemCountRow({ id: item.id, counted_quantity: item.countedQuantity })
        ));
        return;
    }

    // Inventaire lui-même encore en file : on écrit le comptage directement
    // dans sa liste d'articles, plutôt que d'empiler des mises à jour visant
    // des lignes que le serveur ne connaît pas encore.
    const entries = await readOutbox();
    const startEntry = entries.find(
        (e) => e.kind === INVENTORY_START && items.some((item) => e.payload.items.some((i) => i.id === item.id))
    );

    if (startEntry) {
        startEntry.payload.items = startEntry.payload.items.map((row) => {
            const counted = items.find((item) => item.id === row.id);
            return counted ? { ...row, counted_quantity: counted.countedQuantity } : row;
        });
        await writeOutbox(entries);
        return;
    }

    for (const item of items) {
        await enqueue({
            kind: INVENTORY_COUNT,
            payload: { id: item.id, counted_quantity: item.countedQuantity },
            label: 'Comptage d\'inventaire',
        });
    }
};

// Applique les comptages comme nouveau stock (voir validate_inventory) —
// journalisée, refuse un inventaire déjà validé ou sans aucun article
// compté.
export const validateInventoryRow = async ({ id }) => {
    const { data, error } = await supabase.rpc('validate_inventory', {
        p_inventory_id: id,
    });
    if (error) throw error;
    return data;
};

export const validateInventory = async ({ inventoryId }) => {
    const payload = { id: inventoryId, status: 'validated', validated_at: new Date().toISOString() };

    if (navigator.onLine) return validateInventoryRow(payload);

    await enqueue({ kind: INVENTORY_VALIDATE, payload, label: 'Validation d\'un inventaire' });
    return payload;
};

// Un inventaire validé a déjà corrigé le stock : seul un brouillon peut
// être supprimé sans rien laisser d'intraçable derrière lui.
export const deleteInventoryRow = async (id) => {
    const { error } = await supabase
        .from('inventories')
        .delete()
        .eq('id', id)
        .eq('status', 'draft');
    if (error) throw error;
    return id;
};

export const deleteInventory = async (id) => {
    if (navigator.onLine) return deleteInventoryRow(id);

    const entries = await readOutbox();
    const startEntry = entries.find((e) => e.kind === INVENTORY_START && e.payload.id === id);
    if (startEntry) {
        // Le brouillon n'est jamais parti : on retire sa création, et avec
        // elle les comptages qui s'y rattachent — sinon ils tenteraient de
        // mettre à jour des lignes qui n'existeront jamais.
        const itemIds = new Set(startEntry.payload.items.map((i) => i.id));
        await writeOutbox(entries.filter(
            (e) => e.id !== startEntry.id && !(e.kind === INVENTORY_COUNT && itemIds.has(e.payload.id))
        ));
        return id;
    }

    await enqueue({ kind: INVENTORY_DELETE, payload: { id }, label: 'Suppression d\'un inventaire' });
    return id;
};
