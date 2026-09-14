import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const DEBT_ADD = 'debt.add';
export const DEBT_UPDATE = 'debt.update';
export const DEBT_PAY = 'debt.pay';
export const DEBT_DELETE = 'debt.delete';
export const DEBT_PAYMENT_DELETE = 'debt.payment.delete';

/**
 * Ce qu'il reste dû et ce qui a déjà été versé. Une dette se rembourse par
 * tranches (un client doit 10 000 et donne 5 000 aujourd'hui), donc son
 * montant seul ne dit plus où en est le client.
 */
export const withDebtProgress = (debt) => {
    const payments = debt.payments || [];
    const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
        // Versement mis en file hors-ligne : il compte tout de suite pour
        // l'affichage, sinon le commerçant réencaisserait la même avance.
        + Number(debt.pending_payment_amount || 0);
    const amount = Number(debt.amount);
    return {
        ...debt,
        payments,
        amountPaid: paid,
        remaining: Math.max(amount - paid, 0),
        isSettled: paid >= amount,
    };
};

// Jointe au reçu d'origine (s'il y en a un — une dette née d'une vente à
// crédit en a un, une dette saisie manuellement non) pour pouvoir afficher
// les articles pris par le client, pas juste le montant total.
export const fetchDebts = async (businessId) => {
    const { data, error } = await supabase
        .from('debts')
        .select('*, receipt:receipts(id, sales(quantity, total_price, products(name))), payments:debt_payments(id, amount, payment_method, paid_at)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    // Une dette notée pendant une coupure doit apparaître tout de suite : sans
    // ça, le commerçant la ressaisirait en croyant l'avoir ratée.
    const merged = await mergePendingRows(data || [], {
        addKind: DEBT_ADD,
        updateKind: [DEBT_UPDATE, DEBT_PAY],
        deleteKind: DEBT_DELETE,
        businessId,
    });
    return merged.map(withDebtProgress);
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
//
// Chaque versement est une ligne à part (debt_payments) : c'est ce qui permet
// à une avance de compter dans la caisse le jour où elle est reçue, et pas le
// jour où le client finit de rembourser. Le statut de la dette se déduit de la
// somme des versements, côté base.
// Le montant du versement s'appelle `payment_amount` et non `amount` : le
// contenu mis en file est fusionné dans la ligne de dette pour l'affichage
// (voir mergePendingRows), et un champ `amount` y écraserait le montant TOTAL
// de la dette — le client se retrouverait à devoir ce qu'il vient de verser.
export const markDebtPaidRow = async ({ id, payment_id, payment_amount, payment_method, paid_at }) => {
    const { data, error } = await supabase.rpc('record_debt_payment', {
        p_debt_id: id,
        p_amount: payment_amount,
        p_payment_method: payment_method,
        p_paid_at: paid_at,
        // Identifiant tiré côté client : un versement rejoué depuis la file
        // bute sur la clé primaire au lieu d'encaisser deux fois.
        p_id: payment_id,
    });
    if (error) throw error;
    return data;
};

/**
 * Enregistre un versement. `amount` absent = le client solde tout ce qu'il
 * reste, cas le plus courant au comptoir.
 */
export const markDebtPaid = async ({ id, paymentMethod, amount, remaining }) => {
    const due = Number(amount ?? remaining);
    if (!Number.isFinite(due) || due <= 0) {
        throw new Error('Le montant du versement doit être supérieur à 0.');
    }
    if (remaining !== undefined && due > Number(remaining)) {
        throw new Error(`Ce client ne doit plus que ${Number(remaining).toLocaleString('fr-FR')} FCFA.`);
    }

    // La date de remboursement est celle du paiement réel, pas celle de la
    // synchronisation : un client qui rembourse samedi doit compter samedi
    // dans les soldes, même si le réseau ne revient que lundi.
    const payload = {
        id,
        payment_id: newId(),
        payment_amount: due,
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
    };

    if (navigator.onLine) return markDebtPaidRow(payload);

    // Hors-ligne, la dette doit tout de suite refléter l'avance. Les versements
    // déjà en file s'additionnent : deux avances sur la même dette avant le
    // retour du réseau doivent compter pour deux.
    const alreadyQueued = (await pendingOfKind(DEBT_PAY))
        .filter((e) => e.payload.id === id)
        .reduce((sum, e) => sum + Number(e.payload.payment_amount), 0);
    // `remaining` tient déjà compte des versements en file (withDebtProgress
    // les déduit) : ce seul versement suffit donc à solder, ou non.
    const pendingTotal = alreadyQueued + due;
    const settles = remaining !== undefined && due >= Number(remaining);

    await enqueue({
        kind: DEBT_PAY,
        payload: {
            ...payload,
            pending_payment_amount: pendingTotal,
            status: settles ? 'paid' : 'unpaid',
            paid_at: settles ? payload.paid_at : null,
        },
        label: `Versement de ${due} FCFA sur une dette`,
    });
    return id;
};

export const deleteDebtPaymentRow = async ({ id }) => {
    const { data, error } = await supabase.rpc('delete_debt_payment', { p_payment_id: id });
    if (error) throw error;
    return data;
};

// Annuler un versement saisi par erreur : la dette redevient en cours si elle
// avait été soldée par celui-ci.
export const deleteDebtPayment = async (paymentId) => {
    if (navigator.onLine) return deleteDebtPaymentRow({ id: paymentId });

    await enqueue({ kind: DEBT_PAYMENT_DELETE, payload: { id: paymentId }, label: 'Annulation d\'un versement' });
    return paymentId;
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
