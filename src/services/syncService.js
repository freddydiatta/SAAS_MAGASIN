import { get, set } from 'idb-keyval';
import toast from 'react-hot-toast';
import { processSale } from './salesService';
import { addDebt } from './debtsService';

const OFFLINE_SALES_KEY = 'offline_sales';

/**
 * Nombre de ventes en attente de synchronisation — lu par useOfflineStatus
 * pour afficher un badge à l'utilisateur (avant, cette file n'était visible
 * nulle part dans l'interface).
 */
export const getOfflineSalesCount = async () => {
    const offlineSales = await get(OFFLINE_SALES_KEY) || [];
    return offlineSales.length;
};

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

// App.jsx appelle syncOfflineSales à la fois au montage, sur l'événement
// 'online', ET désormais sur un minuteur périodique (l'événement 'online' ne
// se déclenche pas de façon fiable partout, notamment sur mobile) — ce
// verrou évite que deux appels concurrents relisent/réécrivent la même
// file en même temps et se marchent dessus.
let isSyncing = false;

/**
 * Tente de synchroniser toutes les ventes en attente vers Supabase.
 */
export const syncOfflineSales = async (queryClient) => {
    // Le check-and-set doit rester synchrone (pas d'await avant de poser le
    // verrou) : sinon deux appels concurrents peuvent tous les deux passer
    // ce test avant que l'un des deux n'ait eu la chance de positionner
    // isSyncing, et se remettre à lire/écrire la même file en parallèle.
    if (!navigator.onLine || isSyncing) return;
    isSyncing = true;

    try {
        const offlineSales = await get(OFFLINE_SALES_KEY) || [];
        if (offlineSales.length === 0) return;

        console.log(`Synchronisation de ${offlineSales.length} ventes hors-ligne...`);
        let syncedCount = 0;
        const failedSales = [];
        const failures = [];

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

                // Une vente à crédit passée hors-ligne devient une dette dès
                // que la synchro réussit — même logique que la caisse en
                // ligne (useCaisseCart), juste décalée dans le temps. Un
                // échec ici ne remet pas la vente en file (elle a bien été
                // synchronisée) : juste un avertissement distinct.
                if (receipt.payment_method === 'credit') {
                    try {
                        await addDebt({
                            businessId: receipt.business_id,
                            customerName: receipt.customer_name,
                            customerPhone: receipt.customer_phone,
                            amount: receipt.total_amount,
                            note: 'Vente à crédit',
                        });
                    } catch (debtError) {
                        console.error("Erreur lors de l'enregistrement de la dette (vente hors-ligne synchronisée):", debtError.message);
                        toast.error(`⚠️ Vente à ${receipt.customer_name} synchronisée, mais la dette n'a pas pu être enregistrée.`, { duration: 10000 });
                    }
                }
            } catch (e) {
                console.error("Erreur lors de la synchronisation de la vente:", e);
                failedSales.push(receipt);
                failures.push({ receipt, message: e?.message || 'Erreur inconnue' });
            }
        }

        // On ne garde en file d'attente que les ventes qui ont réellement échoué
        // (l'ordre de la boucle n'a pas d'importance, contrairement à un slice
        // basé sur le nombre de succès).
        await set(OFFLINE_SALES_KEY, failedSales);

        if (queryClient) {
            // Toujours invalider, même si syncedCount est 0 : saveOfflineSale a
            // décrémenté le stock affiché de façon optimiste dès la mise en
            // file (avant toute confirmation serveur). Si la synchro échoue —
            // typiquement parce qu'un autre appareil a vendu le même produit
            // entre-temps — ce stock local optimiste est faux et doit être
            // corrigé par les vraies valeurs serveur, pas seulement en cas de
            // succès partiel.
            queryClient.invalidateQueries(['offlineSalesPending']);
            queryClient.invalidateQueries(['receipts']);
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
            queryClient.invalidateQueries(['debts']);
        }

        if (syncedCount > 0) {
            toast.success(`${syncedCount} vente${syncedCount > 1 ? 's' : ''} hors-ligne synchronisée${syncedCount > 1 ? 's' : ''}.`);
        }
        // Échec réel (ex. stock épuisé entre-temps, vendu par un autre appareil
        // pendant qu'on était hors-ligne) : un décompte générique ne dit ni
        // quelle vente ni pourquoi, donc rien d'actionnable pour le caissier.
        // Un toast détaillé par vente permet d'appeler le client, proposer un
        // autre produit, etc. — la vente reste en file pour une nouvelle
        // tentative automatique.
        failures.forEach(({ receipt, message }) => {
            const who = receipt.customer_name ? `à ${receipt.customer_name}` : '(client comptoir)';
            toast.error(`❌ Vente ${who} non synchronisée : ${message}`, { duration: 10000 });
        });
    } finally {
        isSyncing = false;
    }
};
