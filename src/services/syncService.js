import { get, set } from 'idb-keyval';
import toast from 'react-hot-toast';
import { processSale } from './salesService';

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
    const failedSales = [];

    for (const receipt of offlineSales) {
        try {
            // Créée via la même fonction transactionnelle que la caisse en ligne
            // (process_sale) : insertion du reçu, des lignes de vente et décrément
            // du stock en une seule opération atomique côté base de données.
            const { error: saleError } = await processSale({
                businessId: receipt.business_id,
                customerName: receipt.customer_name,
                customerPhone: receipt.customer_phone,
                paymentMethod: receipt.payment_method || 'cash',
                items: receipt.sales.map(sale => ({ product_id: sale.product_id, quantity: sale.quantity })),
                createdAt: receipt.created_at
            });

            if (saleError) throw saleError;
            syncedCount++;
        } catch (e) {
            console.error("Erreur lors de la synchronisation de la vente:", e);
            failedSales.push(receipt);
        }
    }

    // On ne garde en file d'attente que les ventes qui ont réellement échoué
    // (l'ordre de la boucle n'a pas d'importance, contrairement à un slice
    // basé sur le nombre de succès).
    await set(OFFLINE_SALES_KEY, failedSales);

    if (syncedCount > 0 && queryClient) {
        // Rafraîchir le cache pour afficher les vraies IDs générées par Supabase
        queryClient.invalidateQueries(['receipts']);
        queryClient.invalidateQueries(['products']);
        queryClient.invalidateQueries(['sales']);
    }

    if (syncedCount > 0) {
        toast.success(`${syncedCount} vente${syncedCount > 1 ? 's' : ''} hors-ligne synchronisée${syncedCount > 1 ? 's' : ''}.`);
    }
    // Échec réel (ex. stock épuisé entre-temps) : sans ce message, la vente
    // reste en attente indéfiniment sans que personne ne s'en aperçoive.
    if (failedSales.length > 0) {
        toast.error(
            `${failedSales.length} vente${failedSales.length > 1 ? 's' : ''} hors-ligne n'a/n'ont pas pu être synchronisée${failedSales.length > 1 ? 's' : ''}. Nouvelle tentative au prochain retour en ligne.`,
            { duration: 8000 }
        );
    }
};
