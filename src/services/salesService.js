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

export const cancelSale = async ({ receiptId, userEmail }) => {
    return supabase.rpc('cancel_sale', {
        p_receipt_id: receiptId,
        p_user_email: userEmail,
    });
};

export const modifySale = async ({ receiptId, userEmail, items }) => {
    return supabase.rpc('modify_sale', {
        p_receipt_id: receiptId,
        p_user_email: userEmail,
        p_items: items,
    });
};
