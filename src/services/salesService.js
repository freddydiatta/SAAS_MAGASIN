import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { addDebt } from './debtsService';
import { enqueue } from './outbox';

// Types d'opérations mis en file quand le réseau manque (voir outbox.js).
export const SALE_PROCESS = 'sale.process';
export const SALE_CANCEL = 'sale.cancel';
export const SALE_MODIFY = 'sale.modify';

// Ventes/reçus/annulations traités via des fonctions Postgres transactionnelles
// (voir supabase/patches/2026-08-21_critical_fixes.sql) plutôt que par des
// suites d'insert/update séparées côté client. Centralisé ici car appelé à
// la fois depuis la caisse en ligne (Caisse.jsx) et la synchronisation des
// ventes hors-ligne (syncService.js).
export const processSale = async ({ businessId, customerName, customerPhone, paymentMethod, items, createdAt }) => {
    return supabase.rpc('process_sale', {
        p_business_id: businessId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_payment_method: paymentMethod,
        p_items: items,
        p_created_at: createdAt,
    });
};

// L'auteur de la correction est dérivé côté serveur depuis auth.uid()
// (voir current_actor_label), jamais envoyé par le client : plus de
// paramètre userEmail ici (audit de sécurité du 2026-09-10 — un email
// client aurait pu être falsifié pour faire porter la correction à
// quelqu'un d'autre dans le journal Sécurité).
export const cancelSaleRow = async ({ receiptId }) => {
    const { data, error } = await supabase.rpc('cancel_sale', { p_receipt_id: receiptId });
    if (error) throw error;
    return data;
};

export const cancelSale = async ({ receiptId }) => {
    if (navigator.onLine) return supabase.rpc('cancel_sale', { p_receipt_id: receiptId });

    // Annuler une vente encore en file reviendrait à l'envoyer puis à la
    // reprendre : autant ne jamais l'envoyer. Une vente déjà sur le serveur,
    // elle, doit être annulée là-bas au retour du réseau.
    await enqueue({ kind: SALE_CANCEL, payload: { receiptId }, label: 'Annulation d\'une vente' });
    return { data: null, error: null };
};

export const modifySaleRow = async ({ receiptId, items }) => {
    const { data, error } = await supabase.rpc('modify_sale', { p_receipt_id: receiptId, p_items: items });
    if (error) throw error;
    return data;
};

export const modifySale = async ({ receiptId, items }) => {
    if (navigator.onLine) return supabase.rpc('modify_sale', { p_receipt_id: receiptId, p_items: items });

    await enqueue({ kind: SALE_MODIFY, payload: { receiptId, items }, label: 'Correction d\'une vente' });
    return { data: null, error: null };
};

/**
 * Rejoue une vente mise en file : même fonction transactionnelle que la caisse
 * en ligne (process_sale — reçu, lignes et décrément du stock en une seule
 * opération atomique), puis la dette si la vente était à crédit.
 */
export const replayQueuedSale = async (payload) => {
    const { data: syncedReceipt, error } = await processSale({
        businessId: payload.businessId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        paymentMethod: payload.paymentMethod || 'cash',
        items: payload.items,
        createdAt: payload.createdAt,
    });
    if (error) throw error;

    // Une vente à crédit passée hors-ligne devient une dette dès que la
    // synchro réussit — même logique que la caisse en ligne (useCaisseCart),
    // juste décalée dans le temps.
    //
    // L'échec de la dette ne doit PAS faire échouer l'entrée : la vente, elle,
    // est déjà passée, et la rejouer créerait un deuxième reçu et un deuxième
    // décrément de stock. On avertit, et la dette reste à saisir à la main.
    if (payload.paymentMethod === 'credit') {
        try {
            await addDebt({
                businessId: payload.businessId,
                customerName: payload.customerName,
                customerPhone: payload.customerPhone,
                amount: payload.total,
                note: 'Vente à crédit',
                receiptId: syncedReceipt?.id,
            });
        } catch (debtError) {
            console.error("Erreur lors de l'enregistrement de la dette (vente hors-ligne synchronisée):", debtError.message);
            toast.error(
                `⚠️ Vente à ${payload.customerName} synchronisée, mais la dette n'a pas pu être enregistrée.`,
                { duration: 10000 }
            );
        }
    }

    return syncedReceipt;
};
