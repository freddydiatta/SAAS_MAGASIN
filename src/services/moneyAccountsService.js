import { supabase } from '../lib/supabase';
import { enqueue, newId, mergePendingRows, pendingOfKind, dropEntry } from './outbox';

export const ACCOUNT_ADD = 'moneyAccount.add';
export const ACCOUNT_UPDATE = 'moneyAccount.update';
export const ACCOUNT_DELETE = 'moneyAccount.delete';

// Comptes où l'argent du commerce se trouve réellement : tiroir-caisse, Wave,
// Orange Money... On n'y saisit qu'un point de départ daté ; le solde courant
// est ensuite calculé à partir des encaissements et des dépenses (voir
// useFinances), pour ne pas avoir à le corriger après chaque vente.
export const fetchMoneyAccounts = async (businessId) => {
    const { data, error } = await supabase
        .from('money_accounts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at');
    if (error) throw error;
    return mergePendingRows(data || [], {
        addKind: ACCOUNT_ADD,
        updateKind: ACCOUNT_UPDATE,
        deleteKind: ACCOUNT_DELETE,
        businessId,
    });
};

export const insertMoneyAccountRow = async (row) => {
    const { error } = await supabase.from('money_accounts').insert([row]);
    if (error) throw error;
    return row;
};

// initial_balance est figé ici une fois pour toutes : c'est ce que le compte
// contenait le jour où on l'a créé, donc ce que le commerce avait gagné avant
// d'être suivi par l'application. Le chiffre d'affaires total en part, et
// aucune correction de solde ultérieure ne doit le faire bouger.
export const addMoneyAccount = async ({ businessId, name, kind, openingBalance }) => {
    const row = {
        id: newId(),
        business_id: businessId,
        name,
        kind,
        opening_balance: openingBalance,
        initial_balance: openingBalance,
        // Le point de départ décrit ce qu'on a en main à cet instant : figé
        // dès la saisie, il reste juste même si la synchro n'a lieu que
        // demain (voir le calcul des soldes dans useFinances).
        opening_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
    };

    if (navigator.onLine) return insertMoneyAccountRow(row);

    await enqueue({ kind: ACCOUNT_ADD, payload: row, businessId, label: `Nouveau compte ${name}` });
    return row;
};

export const updateMoneyAccountRow = async ({ id, ...fields }) => {
    const { error } = await supabase.from('money_accounts').update(fields).eq('id', id);
    if (error) throw error;
    return id;
};

// Corriger le point de départ le redate à maintenant : le montant saisi
// décrit ce qu'on a en main à cet instant, donc les mouvements ne comptent
// qu'à partir de là — sinon les ventes déjà passées seraient comptées deux
// fois, une fois dans le montant saisi et une fois dans l'historique.
export const updateMoneyAccount = async ({ id, name, kind, openingBalance }) => {
    const payload = { id, name, kind, opening_balance: openingBalance, opening_at: new Date().toISOString() };

    if (navigator.onLine) return updateMoneyAccountRow(payload);

    const queuedAdd = (await pendingOfKind(ACCOUNT_ADD)).find((e) => e.payload.id === id);
    if (queuedAdd) {
        // Compte jamais parti : corriger sa création garde initial_balance
        // cohérent avec ce qui sera réellement enregistré.
        await dropEntry(queuedAdd.id);
        await enqueue({
            kind: ACCOUNT_ADD,
            payload: { ...queuedAdd.payload, ...payload, initial_balance: openingBalance },
            businessId: queuedAdd.businessId,
            label: queuedAdd.label,
        });
        return id;
    }

    await enqueue({ kind: ACCOUNT_UPDATE, payload, label: `Solde de ${name}` });
    return id;
};

export const deleteMoneyAccountRow = async (id) => {
    const { error } = await supabase.from('money_accounts').delete().eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteMoneyAccount = async (id) => {
    if (navigator.onLine) return deleteMoneyAccountRow(id);

    const queuedAdd = (await pendingOfKind(ACCOUNT_ADD)).find((e) => e.payload.id === id);
    if (queuedAdd) {
        await dropEntry(queuedAdd.id);
        return id;
    }

    await enqueue({ kind: ACCOUNT_DELETE, payload: { id }, label: 'Suppression d\'un compte' });
    return id;
};
