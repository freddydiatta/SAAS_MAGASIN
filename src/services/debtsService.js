import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const DEBT_ADD = 'debt.add';
export const DEBT_UPDATE = 'debt.update';
export const DEBT_PAY = 'debt.pay';
export const DEBT_DELETE = 'debt.delete';

// Jointe au reçu d'origine (s'il y en a un — une dette née d'une vente à
// crédit en a un, une dette saisie manuellement non) pour pouvoir afficher
// les articles pris par le client, pas juste le montant total.
export const fetchDebts = async (businessId) => {
    const { data, error } = await supabase
        .from('debts')
        .select('*, receipt:receipts(id, sales(quantity, total_price, products(name)))')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    // Une dette notée pendant une coupure doit apparaître tout de suite : sans
    // ça, le commerçant la ressaisirait en croyant l'avoir ratée.
    return mergePendingRows(data || [], {
        addKind: DEBT_ADD,
        updateKind: [DEBT_UPDATE, DEBT_PAY],
        deleteKind: DEBT_DELETE,
        businessId,
    });
};

export const insertDebtRow = async (row) => {
    const { error } = await supabase.from('debts').insert([row]);
    if (error) throw error;
    return row;
};

export const addDebt = async ({ businessId, customerName, customerPhone, amount, note, receiptId }) => {
    const row = {
        id: newId(),
        business_id: businessId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        amount,
        note: note || null,
        receipt_id: receiptId || null,
        created_at: new Date().toISOString(),
    };

    if (navigator.onLine) return insertDebtRow(row);

    await enqueue({
        kind: DEBT_ADD,
        payload: row,
        businessId,
        label: `Dette de ${customerName} (${amount} FCFA)`,
    });
    return row;
};

// Modification avec journal d'audit (voir update_debt). L'auteur est
// dérivé côté serveur depuis auth.uid() (current_actor_label), jamais
// envoyé par le client — audit de sécurité du 2026-09-10, un email client
// aurait pu être falsifié pour faire porter la correction à quelqu'un
// d'autre dans le journal Sécurité.
export const updateDebtRow = async ({ id, customer_name, customer_phone, amount, note }) => {
    const { data, error } = await supabase.rpc('update_debt', {
        p_debt_id: id,
        p_customer_name: customer_name,
        p_customer_phone: customer_phone || null,
        p_amount: amount,
        p_note: note || null,
    });
    if (error) throw error;
    return data;
};

export const updateDebt = async ({ debtId, customerName, customerPhone, amount, note }) => {
    const payload = {
        id: debtId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        amount,
        note: note || null,
    };

    if (navigator.onLine) return updateDebtRow(payload);

    // Dette elle-même encore en file : on corrige la saisie sur place plutôt
    // que d'empiler une modification qui porterait sur une ligne inexistante.
    const queuedAdd = (await pendingOfKind(DEBT_ADD)).find((e) => e.payload.id === debtId);
    if (queuedAdd) {
        await dropEntry(queuedAdd.id);
        await enqueue({
            kind: DEBT_ADD,
            payload: { ...queuedAdd.payload, ...payload },
            businessId: queuedAdd.businessId,
            label: queuedAdd.label,
        });
        return payload;
    }

    await enqueue({ kind: DEBT_UPDATE, payload, label: `Modification de la dette de ${customerName}` });
    return payload;
};

// paymentMethod ('cash' | 'mobile_money') : par quel moyen le client a
// remboursé. Sans lui, l'argent rentré ne peut pas être rattaché aux espèces
// ou au Mobile Money pour recouper la caisse (voir useFinances).
export const markDebtPaidRow = async ({ id, payment_method, paid_at }) => {
    const { error } = await supabase
        .from('debts')
        .update({ status: 'paid', paid_at, payment_method })
        .eq('id', id);
    if (error) throw error;
    return id;
};

export const markDebtPaid = async ({ id, paymentMethod }) => {
    // La date de remboursement est celle du paiement réel, pas celle de la
    // synchronisation : un client qui rembourse samedi doit compter samedi
    // dans les soldes, même si le réseau ne revient que lundi. `status` fait
    // partie du contenu mis en file pour que la dette s'affiche remboursée
    // immédiatement, sans attendre le retour du réseau.
    const payload = { id, status: 'paid', payment_method: paymentMethod, paid_at: new Date().toISOString() };

    if (navigator.onLine) return markDebtPaidRow(payload);

    await enqueue({ kind: DEBT_PAY, payload, label: 'Remboursement d\'une dette' });
    return id;
};

export const deleteDebtRow = async (id) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteDebt = async (id) => {
    if (navigator.onLine) return deleteDebtRow(id);

    const queuedAdd = (await pendingOfKind(DEBT_ADD)).find((e) => e.payload.id === id);
    if (queuedAdd) {
        await dropEntry(queuedAdd.id);
        return id;
    }

    await enqueue({ kind: DEBT_DELETE, payload: { id }, label: 'Suppression d\'une dette' });
    return id;
};
