import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const SUPPLIER_ADD = 'supplier.add';
export const SUPPLIER_UPDATE = 'supplier.update';
export const SUPPLIER_DELETE = 'supplier.delete';

export const fetchSuppliers = async (businessId) => {
    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
    if (error) throw error;

    const merged = await mergePendingRows(data || [], {
        addKind: SUPPLIER_ADD,
        updateKind: SUPPLIER_UPDATE,
        deleteKind: SUPPLIER_DELETE,
        businessId,
    });
    return merged.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
};

export const insertSupplierRow = async (row) => {
    const { error } = await supabase.from('suppliers').insert([row]);
    if (error) throw error;
    return row;
};

export const addSupplier = async ({ businessId, name, contactName, phone, email }) => {
    const row = {
        id: newId(),
        business_id: businessId,
        name,
        contact_name: contactName || null,
        phone: phone || null,
        email: email || null,
    };

    if (navigator.onLine) return insertSupplierRow(row);

    await enqueue({ kind: SUPPLIER_ADD, payload: row, businessId, label: `Nouveau fournisseur ${name}` });
    return row;
};

export const updateSupplierRow = async ({ id, ...fields }) => {
    const { error } = await supabase.from('suppliers').update(fields).eq('id', id);
    if (error) throw error;
    return id;
};

export const updateSupplier = async ({ id, name, contactName, phone, email }) => {
    const payload = {
        id,
        name,
        contact_name: contactName || null,
        phone: phone || null,
        email: email || null,
    };

    if (navigator.onLine) return updateSupplierRow(payload);

    const queuedAdd = (await pendingOfKind(SUPPLIER_ADD)).find((e) => e.payload.id === id);
    if (queuedAdd) {
        await dropEntry(queuedAdd.id);
        await enqueue({
            kind: SUPPLIER_ADD,
            payload: { ...queuedAdd.payload, ...payload },
            businessId: queuedAdd.businessId,
            label: queuedAdd.label,
        });
        return id;
    }

    await enqueue({ kind: SUPPLIER_UPDATE, payload, label: `Modification de ${name}` });
    return id;
};

export const deleteSupplierRow = async (id) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteSupplier = async (id) => {
    if (navigator.onLine) return deleteSupplierRow(id);

    const queuedAdd = (await pendingOfKind(SUPPLIER_ADD)).find((e) => e.payload.id === id);
    if (queuedAdd) {
        await dropEntry(queuedAdd.id);
        return id;
    }

    await enqueue({ kind: SUPPLIER_DELETE, payload: { id }, label: 'Suppression d\'un fournisseur' });
    return id;
};
