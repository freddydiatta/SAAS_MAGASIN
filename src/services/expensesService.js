import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const EXPENSE_CATEGORIES = {
    transport: 'Transport',
    loyer: 'Loyer',
    fournitures: 'Fournitures',
    divers: 'Divers',
};

export const EXPENSE_ADD = 'expense.add';
export const EXPENSE_DELETE = 'expense.delete';

export const fetchExpenses = async (businessId) => {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    // Les dépenses saisies hors-ligne doivent rester visibles (et comptées
    // dans les soldes) avant même d'avoir atteint le serveur.
    return mergePendingRows(data || [], {
        addKind: EXPENSE_ADD,
        deleteKind: EXPENSE_DELETE,
        businessId,
    });
};

// Rejoué tel quel au retour du réseau : la ligne est complète dès la saisie,
// id et date compris, donc une dépense de mardi reste datée de mardi même si
// elle part le mercredi.
export const insertExpenseRow = async (row) => {
    const { error } = await supabase.from('expenses').insert([row]);
    if (error) throw error;
    return row;
};

// paymentMethod ('cash' | 'mobile_money') : d'où l'argent est sorti. Sans
// lui, une dépense payée par Wave viderait la caisse dans le calcul des
// soldes (voir useFinances).
export const addExpense = async ({ businessId, category, label, amount, paymentMethod, createdBy }) => {
    const row = {
        id: newId(),
        business_id: businessId,
        category,
        label: label || null,
        amount,
        payment_method: paymentMethod,
        created_by: createdBy || null,
        created_at: new Date().toISOString(),
    };

    if (navigator.onLine) return insertExpenseRow(row);

    await enqueue({
        kind: EXPENSE_ADD,
        payload: row,
        businessId,
        label: `Dépense ${EXPENSE_CATEGORIES[category] || category} de ${amount} FCFA`,
    });
    return row;
};

export const deleteExpenseRow = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteExpense = async (id) => {
    if (navigator.onLine) return deleteExpenseRow(id);

    // Supprimer une dépense qui n'est elle-même pas encore partie : inutile de
    // faire l'aller-retour, on annule simplement son entrée dans la file.
    // Sinon le serveur recevrait une création suivie d'une suppression.
    const queuedAdd = (await pendingOfKind(EXPENSE_ADD)).find((e) => e.payload.id === id);
    if (queuedAdd) {
        await dropEntry(queuedAdd.id);
        return id;
    }

    await enqueue({
        kind: EXPENSE_DELETE,
        payload: { id },
        label: 'Suppression d\'une dépense',
    });
    return id;
};
