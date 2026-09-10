import { supabase } from '../lib/supabase';

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
export const cancelSale = async ({ receiptId }) => {
    return supabase.rpc('cancel_sale', {
        p_receipt_id: receiptId,
    });
};

export const modifySale = async ({ receiptId, items }) => {
    return supabase.rpc('modify_sale', {
        p_receipt_id: receiptId,
        p_items: items,
    });
};
