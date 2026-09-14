import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueue, readOutbox, getOutboxCount, pendingOfKind, dropEntry, mergePendingRows, newId } from './outbox';
import { addExpense, deleteExpense, fetchExpenses } from './expensesService';
import { addProduct, updateProduct } from './productsService';
import { startInventory, saveInventoryCounts, fetchInventoryItems, deleteInventory } from './inventoriesService';
import { createPurchaseOrder, receivePurchaseOrder, attachPurchaseOrderInvoice, fetchPurchaseOrders } from './purchaseOrdersService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        single: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

describe('outbox', () => {
    beforeEach(() => {
        fromMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    it('gives every queued write a distinct id, so a replay cannot duplicate a row', () => {
        const ids = new Set(Array.from({ length: 200 }, () => newId()));
        expect(ids.size).toBe(200);
    });

    it('keeps writes in the order they were made', async () => {
        await enqueue({ kind: 'a', payload: { n: 1 } });
        await enqueue({ kind: 'b', payload: { n: 2 } });
        await enqueue({ kind: 'a', payload: { n: 3 } });

        expect((await readOutbox()).map((e) => e.payload.n)).toEqual([1, 2, 3]);
        await expect(getOutboxCount()).resolves.toBe(3);
        await expect(pendingOfKind('a')).resolves.toHaveLength(2);
    });

    it('drops a single entry without touching the others', async () => {
        const first = await enqueue({ kind: 'a', payload: { n: 1 } });
        await enqueue({ kind: 'a', payload: { n: 2 } });

        await dropEntry(first.id);

        expect((await readOutbox()).map((e) => e.payload.n)).toEqual([2]);
    });
});

describe('mergePendingRows', () => {
    it('shows rows created offline ahead of the server ones', async () => {
        await enqueue({ kind: 'x.add', payload: { id: 'local-1', name: 'Local' }, businessId: 'biz-1' });

        const merged = await mergePendingRows([{ id: 'srv-1', name: 'Serveur' }], {
            addKind: 'x.add', deleteKind: 'x.del', businessId: 'biz-1',
        });

        expect(merged.map((r) => r.id)).toEqual(['local-1', 'srv-1']);
        expect(merged[0].isPending).toBe(true);
    });

    it('never shows a row twice while it is being synced', async () => {
        // pendant le rejeu, la ligne peut exister des deux côtés : déjà
        // insérée en base, pas encore retirée de la file. L'id commun, tiré à
        // la création, permet de ne la garder qu'une fois.
        await enqueue({ kind: 'x.add', payload: { id: 'shared', name: 'Local' }, businessId: 'biz-1' });

        const merged = await mergePendingRows([{ id: 'shared', name: 'Serveur' }], {
            addKind: 'x.add', deleteKind: 'x.del', businessId: 'biz-1',
        });

        expect(merged).toHaveLength(1);
    });

    it('hides a row deleted offline and applies a pending correction', async () => {
        await enqueue({ kind: 'x.del', payload: { id: 'srv-1' }, businessId: 'biz-1' });
        await enqueue({ kind: 'x.upd', payload: { id: 'srv-2', name: 'Corrigé' }, businessId: 'biz-1' });

        const merged = await mergePendingRows(
            [{ id: 'srv-1', name: 'A' }, { id: 'srv-2', name: 'B' }],
            { addKind: 'x.add', updateKind: 'x.upd', deleteKind: 'x.del', businessId: 'biz-1' }
        );

        expect(merged).toEqual([expect.objectContaining({ id: 'srv-2', name: 'Corrigé', isPending: true })]);
    });

    it('applies several pending changes to the same row in order', async () => {
        await enqueue({ kind: 'x.upd', payload: { id: 'd1', amount: 900 }, businessId: 'biz-1' });
        await enqueue({ kind: 'x.pay', payload: { id: 'd1', status: 'paid' }, businessId: 'biz-1' });

        const merged = await mergePendingRows([{ id: 'd1', amount: 500, status: 'unpaid' }], {
            addKind: 'x.add', updateKind: ['x.upd', 'x.pay'], deleteKind: 'x.del', businessId: 'biz-1',
        });

        expect(merged[0]).toMatchObject({ amount: 900, status: 'paid' });
    });

    it('leaves another business\'s pending writes out', async () => {
        await enqueue({ kind: 'x.add', payload: { id: 'other' }, businessId: 'biz-2' });

        const merged = await mergePendingRows([], { addKind: 'x.add', businessId: 'biz-1' });

        expect(merged).toEqual([]);
    });
});

describe('écriture hors-ligne des services', () => {
    beforeEach(() => {
        fromMock.mockReset();
        onlineSpy.mockReturnValue(false);
    });

    it('met une dépense en file au lieu de la perdre, et l\'affiche tout de suite', async () => {
        const row = await addExpense({
            businessId: 'biz-1', category: 'transport', label: 'Taxi', amount: 500, paymentMethod: 'cash',
        });

        // rien n'est parti au serveur...
        expect(fromMock).not.toHaveBeenCalled();
        const [entry] = await readOutbox();
        expect(entry).toMatchObject({ kind: 'expense.add', businessId: 'biz-1' });
        expect(entry.label).toContain('500 FCFA');

        // ...mais la dépense apparaît quand même dans la liste
        onlineSpy.mockReturnValue(true);
        fromMock.mockImplementation(() => createQueryBuilder({ data: [], error: null }));
        const listed = await fetchExpenses('biz-1');
        expect(listed).toEqual([expect.objectContaining({ id: row.id, amount: 500, isPending: true })]);
    });

    it('annule simplement la mise en file quand on supprime une dépense pas encore partie', async () => {
        // sinon le serveur recevrait une création suivie d'une suppression
        const row = await addExpense({
            businessId: 'biz-1', category: 'divers', amount: 200, paymentMethod: 'cash',
        });
        expect(await getOutboxCount()).toBe(1);

        await deleteExpense(row.id);

        expect(await getOutboxCount()).toBe(0);
    });

    it('donne son id définitif à un produit créé hors-ligne', async () => {
        // c'est ce qui permet d'enchaîner (lui passer commande, le vendre)
        // sans attendre le réseau, et de rejouer sans rien réconcilier
        const product = await addProduct({
            businessId: 'biz-1', name: 'Ananas GM', type: 'fruit', price: 1500, costPrice: 1000, stockQuantity: 10,
        });

        expect(product.id).toEqual(expect.any(String));

        await updateProduct({ id: product.id, name: 'Ananas Gros Modèle', type: 'fruit', price: 1600, stockQuantity: 10 });

        // une seule entrée : la création est réécrite plutôt que suivie d'une
        // modification portant sur une ligne encore inexistante côté serveur
        const entries = await readOutbox();
        expect(entries).toHaveLength(1);
        expect(entries[0].kind).toBe('product.add');
        expect(entries[0].payload).toMatchObject({ id: product.id, name: 'Ananas Gros Modèle', price: 1600 });
    });

    it('permet de recevoir un bon de commande passé sans réseau', async () => {
        // c'est l'identifiant tiré côté client qui rend l'enchaînement
        // possible : sans lui, le bon n'aurait pas d'existence à désigner
        const order = await createPurchaseOrder({
            businessId: 'biz-1', supplierId: 's1',
            items: [{ productId: 'p1', quantity: 5, unitCost: 300 }],
        });

        expect(order.total_amount).toBe(1500);

        await receivePurchaseOrder({ id: order.id, paymentMethod: 'cash' });

        const kinds = (await readOutbox()).map((e) => e.kind);
        expect(kinds).toEqual(['purchaseOrder.create', 'purchaseOrder.receive']);
    });

    it('emporte la facture fournisseur dans la file, avant la réception', async () => {
        // une livraison arrive souvent là où le réseau ne passe pas. La photo
        // de la facture voyage donc dans la file (IndexedDB sait stocker un
        // Blob) et part AVANT la réception : la base refuse celle-ci tant que
        // la facture manque, et l'ordre de la file garantit qu'elle est là.
        const order = await createPurchaseOrder({
            businessId: 'biz-1', supplierId: 's1',
            items: [{ productId: 'p1', quantity: 2, unitCost: 500 }],
        });

        const file = new File(['photo'], 'facture-mars.jpg', { type: 'image/jpeg' });
        await attachPurchaseOrderInvoice({ orderId: order.id, businessId: 'biz-1', file });
        await receivePurchaseOrder({ id: order.id, paymentMethod: 'cash' });

        const entries = await readOutbox();
        expect(entries.map((e) => e.kind)).toEqual([
            'purchaseOrder.create', 'purchaseOrder.invoice', 'purchaseOrder.receive',
        ]);
        // le fichier lui-même est conservé, pas seulement son nom
        expect(entries[1].payload.file).toBeInstanceOf(File);

        // et le bon s'affiche comme ayant sa facture, en attente d'envoi
        onlineSpy.mockReturnValue(true);
        fromMock.mockImplementation(() => createQueryBuilder({ data: [], error: null }));
        const [listed] = await fetchPurchaseOrders('biz-1');
        expect(listed).toMatchObject({
            id: order.id,
            invoice_file_name: 'facture-mars.jpg',
            invoice_pending: true,
        });
    });

    it('fait compter un inventaire entier sans réseau, à partir du catalogue en cache', async () => {
        // le cas d'usage type : on compte le stock dans la réserve, là où le
        // réseau ne passe pas. Le serveur ne peut pas dresser la liste des
        // articles à compter, c'est donc l'appareil qui la fournit.
        const products = [
            { id: 'p1', name: 'Ananas GM', stock_quantity: 12 },
            { id: 'p2', name: 'Banane', stock_quantity: 30 },
        ];
        const inventory = await startInventory({ businessId: 'biz-1', note: 'Septembre', products });

        expect(inventory.items).toHaveLength(2);
        expect(inventory.items[0]).toMatchObject({ product_id: 'p1', expected_quantity: 12 });

        await saveInventoryCounts([{ id: inventory.items[0].id, countedQuantity: 10 }]);

        // le comptage est écrit dans l'inventaire en file, pas empilé comme
        // une mise à jour d'une ligne que le serveur ne connaît pas encore
        expect(await getOutboxCount()).toBe(1);
        const items = await fetchInventoryItems(inventory.id);
        expect(items[0].counted_quantity).toBe(10);
    });

    it('retire aussi les comptages quand on supprime un inventaire jamais parti', async () => {
        const products = [{ id: 'p1', name: 'Ananas GM', stock_quantity: 12 }];
        const inventory = await startInventory({ businessId: 'biz-1', note: null, products });
        await saveInventoryCounts([{ id: inventory.items[0].id, countedQuantity: 9 }]);

        await deleteInventory(inventory.id);

        // sinon un comptage orphelin tenterait indéfiniment de mettre à jour
        // une ligne qui n'existera jamais
        expect(await getOutboxCount()).toBe(0);
    });

    it('refuse de démarrer un inventaire hors-ligne sans catalogue en cache', async () => {
        await expect(startInventory({ businessId: 'biz-1', note: null, products: [] }))
            .rejects.toThrow(/sans la liste des produits/);
    });
});
