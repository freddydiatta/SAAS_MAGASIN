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
            // Créée via la même fonction transactionnelle que la caisse en ligne
            // (process_sale) : insertion du reçu, des lignes de vente et décrément
            // du stock en une seule opération atomique côté base de données.
            const { error: saleError } = await supabase.rpc('process_sale', {
                p_business_id: receipt.business_id,
                p_customer_name: receipt.customer_name,
                p_customer_phone: receipt.customer_phone,
                p_payment_method: receipt.payment_method || 'cash',
                p_items: receipt.sales.map(sale => ({ product_id: sale.product_id, quantity: sale.quantity })),
                p_created_at: receipt.created_at
            });

            if (saleError) throw saleError;
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
