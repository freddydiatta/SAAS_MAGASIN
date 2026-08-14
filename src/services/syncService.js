import { get, set } from 'idb-keyval';
import { supabase } from '../lib/supabase';

const OFFLINE_SALES_KEY = 'offline_sales';

/**
 * Sauvegarde une vente dans IndexedDB quand l'application est hors ligne.
 */
export const saveOfflineSale = async (businessId, cart, customerName, customerPhone, total, paymentMethod) => {
    const offlineSales = await get(OFFLINE_SALES_KEY) || [];
    
    const newReceipt = {
        id: 'temp-' + Date.now(),
        business_id: businessId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_amount: total,
        status: 'completed',
        payment_method: paymentMethod || 'cash',
        created_at: new Date().toISOString(),
        isOffline: true,
        sales: cart.map(item => ({
             id: 'temp-sale-' + Date.now() + Math.random(),
             product_id: item.id,
             quantity: item.quantity,
             total_price: item.price * item.quantity,
             products: { name: item.name, type: item.type }
        }))
    };
    
    offlineSales.push(newReceipt);
    await set(OFFLINE_SALES_KEY, offlineSales);
    return newReceipt;
};

/**
 * Tente de synchroniser toutes les ventes en attente vers Supabase.
 */
export const syncOfflineSales = async (queryClient) => {
    if (!navigator.onLine) return;
    
    const offlineSales = await get(OFFLINE_SALES_KEY) || [];
    if (offlineSales.length === 0) return;
    
    console.log(`Synchronisation de ${offlineSales.length} ventes hors-ligne...`);
    let syncedCount = 0;
    
    for (const receipt of offlineSales) {
        try {
            // 1. Insert Receipt
            const { data: dbReceipt, error: receiptError } = await supabase.from('receipts').insert([{
                 business_id: receipt.business_id,
                 customer_name: receipt.customer_name,
                 customer_phone: receipt.customer_phone,
                 total_amount: receipt.total_amount,
                 status: 'completed',
                 payment_method: receipt.payment_method || 'cash',
                 created_at: receipt.created_at
            }]).select().single();
            
            if (receiptError) throw receiptError;
            
            // 2. Insert Sales
            for (const sale of receipt.sales) {
                 await supabase.from('sales').insert([{
                     business_id: receipt.business_id,
                     receipt_id: dbReceipt.id,
                     product_id: sale.product_id,
                     quantity: sale.quantity,
                     total_price: sale.total_price
                 }]);
                 
                 // 3. Update online stock
                 const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', sale.product_id).single();
                 if (p) {
                     await supabase.from('products')
                        .update({ stock_quantity: p.stock_quantity - sale.quantity })
                        .eq('id', sale.product_id);
                 }
            }
            syncedCount++;
        } catch (e) {
            console.error("Erreur lors de la synchronisation de la vente:", e);
        }
    }
    
    // Si toutes les ventes ont été synchronisées, on vide la file d'attente
    if (syncedCount === offlineSales.length) {
        await set(OFFLINE_SALES_KEY, []);
    } else {
        // Sinon, on garde seulement celles qui ont échoué
        const remaining = offlineSales.slice(syncedCount);
        await set(OFFLINE_SALES_KEY, remaining);
    }
    
    if (syncedCount > 0 && queryClient) {
        // Rafraîchir le cache pour afficher les vraies IDs générées par Supabase
        queryClient.invalidateQueries(['receipts']);
        queryClient.invalidateQueries(['products']);
        queryClient.invalidateQueries(['sales']);
    }
};
