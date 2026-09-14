import toast from 'react-hot-toast';
import { readOutbox, writeOutbox, MAX_ATTEMPTS } from './outbox';
import {
    EXPENSE_ADD, EXPENSE_DELETE,
    insertExpenseRow, deleteExpenseRow,
} from './expensesService';
import {
    DEBT_ADD, DEBT_UPDATE, DEBT_PAY, DEBT_DELETE,
    insertDebtRow, updateDebtRow, markDebtPaidRow, deleteDebtRow,
} from './debtsService';
import {
    PRODUCT_ADD, PRODUCT_UPDATE, PRODUCT_DELETE,
    insertProductRow, updateProductRow, deleteProductRow,
} from './productsService';
import {
    SUPPLIER_ADD, SUPPLIER_UPDATE, SUPPLIER_DELETE,
    insertSupplierRow, updateSupplierRow, deleteSupplierRow,
} from './suppliersService';
import {
    SALE_PROCESS, SALE_CANCEL, SALE_MODIFY,
    replayQueuedSale, cancelSaleRow, modifySaleRow,
} from './salesService';
import {
    PO_CREATE, PO_UPDATE, PO_INVOICE, PO_RECEIVE, PO_CANCEL, PO_UNRECEIVE, PO_DELETE,
    createPurchaseOrderRow, updatePurchaseOrderRow, attachInvoiceRow, receivePurchaseOrderRow,
    cancelPurchaseOrderRow, unreceivePurchaseOrderRow, deletePurchaseOrderRow,
} from './purchaseOrdersService';
import {
    INVENTORY_START, INVENTORY_COUNT, INVENTORY_VALIDATE, INVENTORY_DELETE,
    startInventoryRow, updateInventoryItemCountRow, validateInventoryRow, deleteInventoryRow,
} from './inventoriesService';
import {
    ACCOUNT_ADD, ACCOUNT_UPDATE, ACCOUNT_DELETE,
    insertMoneyAccountRow, updateMoneyAccountRow, deleteMoneyAccountRow,
} from './moneyAccountsService';

// Ce que chaque entrée de la file sait rejouer. C'est ici, et pas dans
// outbox.js, que vivent les imports de services : la file reste ainsi un
// simple stockage, sans cycle d'imports avec les services qui l'alimentent.
//
// Un rejeu doit être rejouable deux fois sans dégât : les lignes portent un id
// tiré à la création, donc une insertion déjà passée échouera sur la clé
// primaire au lieu de créer un doublon.
const HANDLERS = {
    [SALE_PROCESS]: (payload) => replayQueuedSale(payload),
    [SALE_CANCEL]: (payload) => cancelSaleRow(payload),
    [SALE_MODIFY]: (payload) => modifySaleRow(payload),

    [EXPENSE_ADD]: (payload) => insertExpenseRow(payload),
    [EXPENSE_DELETE]: (payload) => deleteExpenseRow(payload.id),

    [DEBT_ADD]: (payload) => insertDebtRow(payload),
    [DEBT_UPDATE]: (payload) => updateDebtRow(payload),
    [DEBT_PAY]: (payload) => markDebtPaidRow(payload),
    [DEBT_DELETE]: (payload) => deleteDebtRow(payload.id),

    [PRODUCT_ADD]: (payload) => insertProductRow(payload),
    [PRODUCT_UPDATE]: (payload) => updateProductRow(payload),
    [PRODUCT_DELETE]: (payload) => deleteProductRow(payload.id),

    [SUPPLIER_ADD]: (payload) => insertSupplierRow(payload),
    [SUPPLIER_UPDATE]: (payload) => updateSupplierRow(payload),
    [SUPPLIER_DELETE]: (payload) => deleteSupplierRow(payload.id),

    [PO_CREATE]: (payload) => createPurchaseOrderRow(payload),
    [PO_UPDATE]: (payload) => updatePurchaseOrderRow(payload),
    // Placée avant la réception dans la file : celle-ci sera refusée par la
    // base tant que la facture n'est pas arrivée, et l'ordre garantit
    // qu'elle l'est.
    [PO_INVOICE]: (payload) => attachInvoiceRow(payload),
    [PO_RECEIVE]: (payload) => receivePurchaseOrderRow(payload),
    [PO_CANCEL]: (payload) => cancelPurchaseOrderRow(payload.id),
    [PO_UNRECEIVE]: (payload) => unreceivePurchaseOrderRow(payload),
    [PO_DELETE]: (payload) => deletePurchaseOrderRow(payload.id),

    [INVENTORY_START]: (payload) => startInventoryRow(payload),
    [INVENTORY_COUNT]: (payload) => updateInventoryItemCountRow(payload),
    [INVENTORY_VALIDATE]: (payload) => validateInventoryRow(payload),
    [INVENTORY_DELETE]: (payload) => deleteInventoryRow(payload.id),

    [ACCOUNT_ADD]: (payload) => insertMoneyAccountRow(payload),
    [ACCOUNT_UPDATE]: (payload) => updateMoneyAccountRow(payload),
    [ACCOUNT_DELETE]: (payload) => deleteMoneyAccountRow(payload.id),
};

// Même verrou que syncOfflineSales : App.jsx déclenche la synchronisation au
// démarrage, sur l'événement 'online' et sur un minuteur, et deux passes
// concurrentes réécriraient la même file.
let isFlushing = false;

/**
 * Rejoue les écritures en attente, dans l'ordre où elles ont été faites.
 *
 * L'ordre compte : créer un fournisseur puis lui passer commande ne veut rien
 * dire à l'envers. Une entrée qui échoue arrête donc la file au lieu de
 * laisser passer les suivantes — sauf si elle a épuisé ses tentatives, auquel
 * cas elle est mise de côté pour ne pas tout bloquer indéfiniment.
 */
export const flushOutbox = async (queryClient) => {
    if (!navigator.onLine || isFlushing) return { synced: 0, blocked: 0 };
    isFlushing = true;

    try {
        let entries = await readOutbox();
        if (entries.length === 0) return { synced: 0, blocked: 0 };

        let synced = 0;
        const newlyBlocked = [];

        for (const entry of [...entries]) {
            if (entry.blocked) continue;

            const handler = HANDLERS[entry.kind];
            if (!handler) {
                // Entrée écrite par une version plus récente de l'app, ou type
                // retiré depuis : la garder en file éternellement n'aiderait
                // personne, on la signale et on la met de côté.
                entry.blocked = true;
                entry.lastError = `Opération inconnue (${entry.kind})`;
                newlyBlocked.push(entry);
                continue;
            }

            try {
                await handler(entry.payload);
                entries = entries.filter((e) => e.id !== entry.id);
                await writeOutbox(entries);
                synced++;
            } catch (e) {
                entry.attempts = (entry.attempts || 0) + 1;
                entry.lastError = e?.message || 'Erreur inconnue';

                if (entry.attempts >= MAX_ATTEMPTS) {
                    entry.blocked = true;
                    newlyBlocked.push(entry);
                    await writeOutbox(entries);
                    continue;
                }

                // Réessayée au prochain passage : on s'arrête ici pour ne pas
                // appliquer les suivantes avant celle-ci.
                await writeOutbox(entries);
                break;
            }
        }

        if (queryClient) {
            // Les listes affichées mélangeaient jusque-là lignes serveur et
            // lignes en attente : une fois la file vidée, il faut relire le
            // serveur pour repartir sur des données confirmées.
            ['expenses', 'debts', 'products', 'suppliers', 'purchase_orders', 'sales', 'receipts',
                'money_accounts', 'inventories', 'inventory_items', 'finances-sales']
                .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
            queryClient.invalidateQueries({ queryKey: ['offlineSalesPending'] });
        }

        if (synced > 0) {
            toast.success(`${synced} opération${synced > 1 ? 's' : ''} synchronisée${synced > 1 ? 's' : ''}.`);
        }
        // Une opération définitivement refusée doit être dite : elle ne partira
        // jamais toute seule, et l'utilisateur croit son écriture enregistrée.
        newlyBlocked.forEach((entry) => {
            toast.error(`❌ ${entry.label} : ${entry.lastError}`, { duration: 12000 });
        });

        return { synced, blocked: newlyBlocked.length };
    } finally {
        isFlushing = false;
    }
};
