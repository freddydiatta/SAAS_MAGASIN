import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const PO_CREATE = 'purchaseOrder.create';
export const PO_UPDATE = 'purchaseOrder.update';
export const PO_RECEIVE = 'purchaseOrder.receive';
export const PO_CANCEL = 'purchaseOrder.cancel';
export const PO_UNRECEIVE = 'purchaseOrder.unreceive';
export const PO_DELETE = 'purchaseOrder.delete';

const rpcItems = (items) => items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    unit_cost: item.unitCost,
}));

const totalOf = (items) => items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_cost), 0);

export const fetchPurchaseOrders = async (businessId) => {
    const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(id, name, contact_name, phone, email), items:purchase_order_items(id, product_id, product_name, quantity, unit_cost)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    // Un bon passé pendant une coupure doit rester visible, sinon le
    // commerçant le ressaisirait en croyant l'avoir raté.
    return mergePendingRows(data || [], {
        addKind: PO_CREATE,
        updateKind: [PO_UPDATE, PO_RECEIVE, PO_CANCEL, PO_UNRECEIVE],
        deleteKind: PO_DELETE,
        businessId,
    });
};

// Création atomique du bon + ses lignes côté base (voir create_purchase_order
// dans supabase/patches/2026-09-02_suppliers_and_purchase_orders.sql) — évite
// un bon de commande sans ligne si l'insertion des lignes échouait après
// celle du bon.
export const createPurchaseOrderRow = async (payload) => {
    const { data, error } = await supabase.rpc('create_purchase_order', {
        p_business_id: payload.business_id,
        p_supplier_id: payload.supplier_id || null,
        p_items: payload.items,
        // Identifiant tiré côté client : le bon garde le même avant et après
        // synchronisation, donc le recevoir ou le corriger hors-ligne vise
        // bien la même ligne (voir 2026-09-14_offline_client_ids.sql).
        p_id: payload.id,
    });
    if (error) throw error;
    return data;
};

export const createPurchaseOrder = async ({ businessId, supplierId, items }) => {
    const mapped = rpcItems(items);
    const payload = {
        id: newId(),
        business_id: businessId,
        supplier_id: supplierId || null,
        items: mapped,
    };

    if (navigator.onLine) return createPurchaseOrderRow(payload);

    const total = totalOf(mapped);
    await enqueue({
        kind: PO_CREATE,
        businessId,
        label: `Bon de commande de ${total} FCFA`,
        // La forme attendue par la liste, pour l'afficher en attendant.
        payload: { ...payload, status: 'pending', total_amount: total, created_at: new Date().toISOString() },
    });
    return { ...payload, status: 'pending', total_amount: total };
};

// Modification d'un bon en attente : journalisée côté base (voir
// update_purchase_order) — jamais une correction silencieuse, toujours une
// trace consultable dans Sécurité. Refuse un bon déjà reçu/annulé. L'auteur
// est dérivé côté serveur depuis auth.uid() (current_actor_label), jamais
// envoyé par le client (audit de sécurité du 2026-09-10).
export const updatePurchaseOrderRow = async (payload) => {
    const { data, error } = await supabase.rpc('update_purchase_order', {
        p_order_id: payload.id,
        p_supplier_id: payload.supplier_id || null,
        p_items: payload.items,
    });
    if (error) throw error;
    return data;
};

export const updatePurchaseOrder = async ({ orderId, supplierId, items }) => {
    const mapped = rpcItems(items);
    const payload = { id: orderId, supplier_id: supplierId || null, items: mapped };

    if (navigator.onLine) return updatePurchaseOrderRow(payload);

    // Bon lui-même encore en file : on réécrit sa création plutôt que
    // d'empiler une correction portant sur une ligne inexistante côté serveur.
    const queuedCreate = (await pendingOfKind(PO_CREATE)).find((e) => e.payload.id === orderId);
    if (queuedCreate) {
        await dropEntry(queuedCreate.id);
        await enqueue({
            kind: PO_CREATE,
            businessId: queuedCreate.businessId,
            label: queuedCreate.label,
            payload: { ...queuedCreate.payload, ...payload, total_amount: totalOf(mapped) },
        });
        return payload;
    }

    await enqueue({ kind: PO_UPDATE, payload, label: 'Correction d\'un bon de commande' });
    return payload;
};

// Augmente le stock des produits de la commande et marque le bon comme reçu
// (voir receive_purchase_order) — refuse un bon déjà traité.
// L'argent sort au moment de la réception, pas de la commande : c'est donc
// ici qu'on enregistre par quel moyen le fournisseur a été payé.
export const receivePurchaseOrderRow = async ({ id, payment_method }) => {
    const { data, error } = await supabase.rpc('receive_purchase_order', {
        p_purchase_order_id: id,
        p_payment_method: payment_method,
    });
    if (error) throw error;
    return data;
};

export const receivePurchaseOrder = async ({ id, paymentMethod }) => {
    // La date de réception est celle de la livraison réelle : c'est elle qui
    // date la sortie d'argent dans les soldes (voir useFinances).
    const payload = { id, payment_method: paymentMethod, status: 'received', received_at: new Date().toISOString() };

    if (navigator.onLine) return receivePurchaseOrderRow(payload);

    await enqueue({ kind: PO_RECEIVE, payload, label: 'Réception d\'un bon de commande' });
    return payload;
};

export const cancelPurchaseOrderRow = async (id) => {
    const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending');
    if (error) throw error;
    return id;
};

export const cancelPurchaseOrder = async (id) => {
    if (navigator.onLine) return cancelPurchaseOrderRow(id);

    const queuedCreate = (await pendingOfKind(PO_CREATE)).find((e) => e.payload.id === id);
    if (queuedCreate) {
        await dropEntry(queuedCreate.id);
        return id;
    }

    await enqueue({ kind: PO_CANCEL, payload: { id, status: 'cancelled' }, label: 'Annulation d\'un bon de commande' });
    return id;
};

// Corrige un bon marqué reçu par erreur : retire le stock ajouté et repasse
// le bon en attente (voir unreceive_purchase_order) — refuse explicitement
// si une partie de ce stock a déjà été revendue. Journalisée.
export const unreceivePurchaseOrderRow = async ({ id }) => {
    const { data, error } = await supabase.rpc('unreceive_purchase_order', {
        p_purchase_order_id: id,
    });
    if (error) throw error;
    return data;
};

export const unreceivePurchaseOrder = async ({ orderId }) => {
    const payload = { id: orderId, status: 'pending', received_at: null };

    if (navigator.onLine) return unreceivePurchaseOrderRow(payload);

    await enqueue({ kind: PO_UNRECEIVE, payload, label: 'Annulation d\'une réception' });
    return payload;
};

// Suppression définitive d'un bon jamais reçu (voir delete_purchase_order) —
// un bon reçu doit d'abord passer par unreceivePurchaseOrder. Journalisée
// avant suppression (les lignes disparaissent avec le bon).
export const deletePurchaseOrderRow = async (id) => {
    const { error } = await supabase.rpc('delete_purchase_order', {
        p_purchase_order_id: id,
    });
    if (error) throw error;
    return id;
};

export const deletePurchaseOrder = async ({ orderId }) => {
    if (navigator.onLine) return deletePurchaseOrderRow(orderId);

    const queuedCreate = (await pendingOfKind(PO_CREATE)).find((e) => e.payload.id === orderId);
    if (queuedCreate) {
        await dropEntry(queuedCreate.id);
        return orderId;
    }

    await enqueue({ kind: PO_DELETE, payload: { id: orderId }, label: 'Suppression d\'un bon de commande' });
    return orderId;
};
