import { supabase } from '../lib/supabase';
import { deleteProductImage } from './imagesService';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const productKeys = {
    all: (businessId) => ['products', businessId],
};

export const PRODUCT_ADD = 'product.add';
export const PRODUCT_UPDATE = 'product.update';
export const PRODUCT_DELETE = 'product.delete';

export const fetchProducts = async (businessId) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
    if (error) throw error;

    const merged = await mergePendingRows(data || [], {
        addKind: PRODUCT_ADD,
        updateKind: PRODUCT_UPDATE,
        deleteKind: PRODUCT_DELETE,
        businessId,
    });
    // fetchProducts trie par nom côté serveur ; les lignes en attente sont
    // ajoutées en tête par la fusion et casseraient cet ordre à l'écran.
    return merged.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
};

export const insertProductRow = async (row) => {
    const { data, error } = await supabase.from('products').insert([row]).select().single();
    if (error) throw error;
    return data;
};

// Retourne la ligne créée (id inclus) : nécessaire quand un bon de commande
// crée un nouveau produit à la volée (voir useFournisseurs.handleCreateOrder)
// pour connaître l'id à rattacher à la ligne de commande. L'id étant tiré
// côté client, il est connu même hors-ligne — c'est ce qui permet d'enchaîner
// les deux opérations sans attendre le réseau.
export const addProduct = async ({ businessId, name, type, price, costPrice, supplierId, stockQuantity, imageUrl, barcode }) => {
    const row = {
        id: newId(),
        business_id: businessId,
        name,
        type,
        price,
        cost_price: costPrice ?? null,
        supplier_id: supplierId || null,
        stock_quantity: stockQuantity,
        image_url: imageUrl || null,
        barcode: barcode || null,
    };

    if (navigator.onLine) return insertProductRow(row);

    await enqueue({ kind: PRODUCT_ADD, payload: row, businessId, label: `Nouveau produit ${name}` });
    return row;
};

export const updateProductRow = async ({ id, ...fields }) => {
    const { error } = await supabase.from('products').update(fields).eq('id', id);
    if (error) throw error;
    return id;
};

export const updateProduct = async ({ id, name, type, price, costPrice, supplierId, stockQuantity, imageUrl, previousImageUrl, barcode }) => {
    const payload = {
        id,
        name,
        type,
        price,
        cost_price: costPrice ?? null,
        supplier_id: supplierId || null,
        stock_quantity: stockQuantity,
        image_url: imageUrl || null,
        barcode: barcode || null,
    };

    if (!navigator.onLine) {
        // Produit lui-même encore en file : on réécrit sa création plutôt que
        // d'empiler une modification portant sur une ligne qui n'existe pas
        // encore côté serveur.
        const queuedAdd = (await pendingOfKind(PRODUCT_ADD)).find((e) => e.payload.id === id);
        if (queuedAdd) {
            await dropEntry(queuedAdd.id);
            await enqueue({
                kind: PRODUCT_ADD,
                payload: { ...queuedAdd.payload, ...payload },
                businessId: queuedAdd.businessId,
                label: queuedAdd.label,
            });
            return id;
        }

        await enqueue({ kind: PRODUCT_UPDATE, payload, label: `Modification de ${name}` });
        return id;
    }

    await updateProductRow(payload);

    // Best-effort : ne fait jamais échouer la mise à jour du produit
    // elle-même si le nettoyage de l'ancienne photo dans Storage échoue.
    if (previousImageUrl && previousImageUrl !== imageUrl) {
        deleteProductImage(previousImageUrl).catch((e) =>
            console.error('Impossible de supprimer l\'ancienne photo du produit:', e.message)
        );
    }
};

export const deleteProductRow = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteProduct = async ({ id, imageUrl }) => {
    if (!navigator.onLine) {
        const queuedAdd = (await pendingOfKind(PRODUCT_ADD)).find((e) => e.payload.id === id);
        if (queuedAdd) {
            await dropEntry(queuedAdd.id);
            return id;
        }
        await enqueue({ kind: PRODUCT_DELETE, payload: { id }, label: 'Suppression d\'un produit' });
        return id;
    }

    await deleteProductRow(id);

    if (imageUrl) {
        deleteProductImage(imageUrl).catch((e) =>
            console.error('Impossible de supprimer la photo du produit:', e.message)
        );
    }

    return id;
};
