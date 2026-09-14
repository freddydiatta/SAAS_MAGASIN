import { get, del } from 'idb-keyval';
import { SALE_PROCESS } from './salesService';
import { enqueue, newId, readOutbox, writeOutbox } from './outbox';
import { flushOutbox } from './outboxFlush';

// Ancienne file, réservée aux ventes. Conservée uniquement le temps de la
// reprise : les ventes vivent désormais dans la file générale (outbox.js),
// avec les dépenses, les dettes et les réassorts.
const LEGACY_SALES_KEY = 'offline_sales';

export { SALE_PROCESS };

/**
 * Nombre de ventes en attente. La file étant désormais commune, on ne compte
 * que les entrées de vente — le badge, lui, affiche le total des opérations.
 */
export const getOfflineSalesCount = async () => {
    const entries = await readOutbox();
    return entries.filter((e) => e.kind === SALE_PROCESS).length;
};

/**
 * Met une vente en file quand l'application est hors ligne, et renvoie un reçu
 * provisoire pour l'affichage immédiat (historique, facture, stock décrémenté).
 */
export const saveOfflineSale = async (businessId, cart, customerName, customerPhone, total, paymentMethod) => {
    const method = paymentMethod || 'cash';
    const createdAt = new Date().toISOString();

    await enqueue({
        kind: SALE_PROCESS,
        businessId,
        label: `Vente de ${total} FCFA`,
        payload: {
            businessId,
            customerName,
            customerPhone,
            paymentMethod: method,
            // La date de la vente réelle, pas celle de la synchronisation :
            // une vente de mardi soir doit rester comptée mardi.
            createdAt,
            total,
            items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        },
    });

    return {
        id: 'temp-' + Date.now(),
        business_id: businessId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_amount: total,
        status: 'completed',
        payment_method: method,
        created_at: createdAt,
        isOffline: true,
        sales: cart.map((item) => ({
            id: 'temp-sale-' + newId(),
            product_id: item.id,
            quantity: item.quantity,
            total_price: item.price * item.quantity,
            products: { name: item.name, type: item.type },
        })),
    };
};

/**
 * Reprend les ventes laissées dans l'ancienne file par une version précédente
 * de l'application et les remet en tête de la file générale : ce sont les plus
 * anciennes opérations, elles doivent repartir avant celles d'aujourd'hui.
 */
export const migrateLegacySales = async () => {
    const legacy = (await get(LEGACY_SALES_KEY)) || [];
    if (legacy.length === 0) return 0;

    const migrated = legacy.map((receipt) => ({
        id: newId(),
        kind: SALE_PROCESS,
        businessId: receipt.business_id,
        label: `Vente de ${receipt.total_amount} FCFA`,
        payload: {
            businessId: receipt.business_id,
            customerName: receipt.customer_name,
            customerPhone: receipt.customer_phone,
            paymentMethod: receipt.payment_method || 'cash',
            createdAt: receipt.created_at,
            total: receipt.total_amount,
            items: (receipt.sales || []).map((s) => ({ product_id: s.product_id, quantity: s.quantity })),
        },
        queuedAt: receipt.created_at,
        attempts: 0,
        lastError: null,
        blocked: false,
    }));

    const entries = await readOutbox();
    await writeOutbox([...migrated, ...entries]);
    await del(LEGACY_SALES_KEY);
    return migrated.length;
};

/**
 * Point d'entrée historique, appelé par App.jsx. Reprend d'abord l'ancienne
 * file puis vide la file générale.
 */
export const syncOfflineSales = async (queryClient) => {
    if (!navigator.onLine) return;
    await migrateLegacySales();
    await flushOutbox(queryClient);
};
