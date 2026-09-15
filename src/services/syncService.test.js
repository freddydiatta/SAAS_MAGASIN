import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, set } from 'idb-keyval';
import { saveOfflineSale, syncOfflineSales, getOfflineSalesCount } from './syncService';
import { readOutbox } from './outbox';

function createDebtsInsertBuilder(result) {
    const builder = {
        insert: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { rpc: rpcMock, from: fromMock },
}));

const { toastMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
    toastMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
}));

// toast() s'appelle aussi directement (message d'information), pas seulement
// toast.error / toast.success.
vi.mock('react-hot-toast', () => ({
    default: Object.assign(toastMock, { error: toastErrorMock, success: toastSuccessMock }),
}));

const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

const CART = [{ id: 'p1', name: 'Casque', type: 'moto', price: 1000, quantity: 2 }];

describe('saveOfflineSale', () => {
    beforeEach(() => {
        onlineSpy.mockReturnValue(false);
    });

    it('queues the sale and returns a provisional receipt for the screen', async () => {
        const receipt = await saveOfflineSale('biz-1', CART, 'Client Test', '77000', 2000, 'cash');

        expect(receipt.business_id).toBe('biz-1');
        expect(receipt.total_amount).toBe(2000);
        expect(receipt.sales).toHaveLength(1);
        expect(receipt.sales[0]).toMatchObject({ product_id: 'p1', quantity: 2, total_price: 2000 });

        const entries = await readOutbox();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            kind: 'sale.process',
            businessId: 'biz-1',
            payload: { paymentMethod: 'cash', total: 2000, items: [{ product_id: 'p1', quantity: 2 }] },
        });
    });

    it('appends to whatever is already queued, sales or not', async () => {
        await saveOfflineSale('biz-1', CART, '', '', 500, 'cash');
        await saveOfflineSale('biz-1', CART, '', '', 700, 'cash');

        const entries = await readOutbox();
        expect(entries.map((e) => e.payload.total)).toEqual([500, 700]);
    });
});

describe('getOfflineSalesCount', () => {
    it('counts only the sales in the shared queue', async () => {
        onlineSpy.mockReturnValue(false);
        await saveOfflineSale('biz-1', CART, '', '', 500, 'cash');
        // une écriture d'un autre type ne doit pas être comptée comme une vente
        await set('offline_outbox', [
            ...(await get('offline_outbox')),
            { id: 'x', kind: 'expense.add', payload: {}, attempts: 0 },
        ]);

        await expect(getOfflineSalesCount()).resolves.toBe(1);
    });

    it('returns 0 when nothing is queued yet', async () => {
        await expect(getOfflineSalesCount()).resolves.toBe(0);
    });
});

describe('syncOfflineSales', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        fromMock.mockReset();
        toastMock.mockReset();
        toastErrorMock.mockReset();
        toastSuccessMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    const queueSale = async (overrides = {}) => {
        onlineSpy.mockReturnValue(false);
        await saveOfflineSale(
            overrides.businessId || 'biz-1',
            overrides.cart || CART,
            overrides.customerName ?? 'Client',
            overrides.customerPhone ?? '77000',
            overrides.total ?? 2000,
            overrides.paymentMethod || 'cash',
            overrides.invoiceNumber ?? null
        );
        onlineSpy.mockReturnValue(true);
    };

    it('does nothing when the browser is offline', async () => {
        await queueSale();
        onlineSpy.mockReturnValue(false);

        await syncOfflineSales();

        expect(rpcMock).not.toHaveBeenCalled();
        expect(await readOutbox()).toHaveLength(1);
    });

    it('does nothing when there is no queued write', async () => {
        await syncOfflineSales();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('replays a queued sale through process_sale, preserving its original date', async () => {
        await queueSale({ paymentMethod: 'mobile_money' });
        const [queued] = await readOutbox();
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-receipt-1' }, error: null });

        const queryClient = { invalidateQueries: vi.fn() };
        await syncOfflineSales(queryClient);

        expect(rpcMock).toHaveBeenCalledWith('process_sale', {
            p_business_id: 'biz-1',
            p_customer_name: 'Client',
            p_customer_phone: '77000',
            p_payment_method: 'mobile_money',
            p_items: [{ product_id: 'p1', quantity: 2 }],
            // la date de la vente réelle, pas celle de la synchronisation
            p_created_at: queued.payload.createdAt,
            p_invoice_number: null,
        });

        expect(await readOutbox()).toHaveLength(0);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['products'] });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sales'] });
    });

    it('proposes the invoice number printed offline to the database', async () => {
        await queueSale({ invoiceNumber: 'FAC-2026-00032' });
        rpcMock.mockResolvedValueOnce({ data: { id: 'r1', invoice_number: 'FAC-2026-00032', offline_invoice_number: null }, error: null });

        await syncOfflineSales({ invalidateQueries: vi.fn() });

        expect(rpcMock).toHaveBeenCalledWith('process_sale', expect.objectContaining({ p_invoice_number: 'FAC-2026-00032' }));
        // numéro accepté tel quel : rien à signaler
        expect(toastMock).not.toHaveBeenCalled();
    });

    it('says so when the database had to renumber an invoice printed offline', async () => {
        // un autre appareil a vendu pendant la coupure : le client a un papier
        // FAC-2026-00032, la vente est enregistrée sous FAC-2026-00034
        await queueSale({ invoiceNumber: 'FAC-2026-00032' });
        rpcMock.mockResolvedValueOnce({
            data: { id: 'r1', invoice_number: 'FAC-2026-00034', offline_invoice_number: 'FAC-2026-00032' },
            error: null,
        });

        await syncOfflineSales({ invalidateQueries: vi.fn() });

        expect(toastMock).toHaveBeenCalledWith(
            expect.stringMatching(/FAC-2026-00032 renumérotée FAC-2026-00034/),
            expect.objectContaining({ duration: 12000 })
        );
        // la vente est bien partie : pas de nouvelle tentative
        expect(await readOutbox()).toHaveLength(0);
    });

    it('records a debt once a queued credit sale is synced', async () => {
        await queueSale({ paymentMethod: 'credit', customerName: 'Moussa Diop', total: 5000 });
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-receipt-1' }, error: null });
        const debtsBuilder = createDebtsInsertBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => debtsBuilder);

        await syncOfflineSales({ invalidateQueries: vi.fn() });

        expect(fromMock).toHaveBeenCalledWith('debts');
        expect(debtsBuilder.insert).toHaveBeenCalledWith([expect.objectContaining({
            business_id: 'biz-1', customer_name: 'Moussa Diop', amount: 5000,
            // l'id du VRAI reçu créé par la synchro, pas celui du reçu
            // provisoire — pour que Dettes.jsx retrouve les articles pris.
            receipt_id: 'real-receipt-1',
        })]);
        expect(await readOutbox()).toHaveLength(0);
    });

    it('never replays a sale that went through just because its debt failed', async () => {
        // la vente est passée : la rejouer créerait un deuxième reçu et un
        // deuxième décrément de stock. L'entrée sort donc de la file, et
        // l'échec de la dette est signalé à part.
        await queueSale({ paymentMethod: 'credit', customerName: 'Moussa Diop', total: 5000 });
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-receipt-1' }, error: null });
        fromMock.mockImplementation(() => createDebtsInsertBuilder({ data: null, error: new Error('network down') }));

        await syncOfflineSales({ invalidateQueries: vi.fn() });

        expect(toastErrorMock).toHaveBeenCalledWith(
            expect.stringMatching(/Moussa Diop synchronisée, mais la dette n'a pas pu être enregistrée/),
            expect.objectContaining({ duration: 10000 })
        );
        expect(await readOutbox()).toHaveLength(0);
    });

    it('keeps a failed sale queued and refreshes the optimistic stock', async () => {
        // saveOfflineSale a décrémenté le stock affiché sans confirmation
        // serveur : si la synchro échoue (un autre appareil a vendu le même
        // produit entre-temps), ce nombre est faux et doit être corrigé.
        await queueSale();
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Stock insuffisant') });

        const queryClient = { invalidateQueries: vi.fn() };
        await syncOfflineSales(queryClient);

        const entries = await readOutbox();
        expect(entries).toHaveLength(1);
        expect(entries[0].attempts).toBe(1);
        expect(entries[0].lastError).toBe('Stock insuffisant');
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['products'] });
    });

    it('stops at the first failure instead of applying later writes out of order', async () => {
        // créer un fournisseur puis lui passer commande n'a pas de sens à
        // l'envers : une entrée en échec retient celles d'après.
        await queueSale({ total: 1000 });
        await queueSale({ total: 2000 });
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Stock insuffisant') });

        await syncOfflineSales({ invalidateQueries: vi.fn() });

        expect(rpcMock).toHaveBeenCalledTimes(1);
        expect(await readOutbox()).toHaveLength(2);
    });

    it('sets a write aside after too many attempts, so it stops blocking the rest', async () => {
        await queueSale();
        rpcMock.mockResolvedValue({ data: null, error: new Error('refusé') });

        for (let i = 0; i < 5; i++) {
            await syncOfflineSales({ invalidateQueries: vi.fn() });
        }

        const [entry] = await readOutbox();
        expect(entry.blocked).toBe(true);
        expect(toastErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('refusé'),
            expect.objectContaining({ duration: 12000 })
        );
    });

    it('ignores a concurrent call while a sync is already in flight', async () => {
        await queueSale();
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-1' }, error: null });

        const first = syncOfflineSales({ invalidateQueries: vi.fn() });
        const second = syncOfflineSales({ invalidateQueries: vi.fn() }); // verrou déjà pris

        await Promise.all([first, second]);

        expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('takes over sales left in the queue of a previous app version', async () => {
        // une vente en attente sur le téléphone au moment de la mise à jour ne
        // doit pas être perdue, et doit repartir avant celles d'aujourd'hui.
        await set('offline_sales', [{
            id: 'temp-old',
            business_id: 'biz-1',
            customer_name: 'Ancien Client',
            payment_method: 'cash',
            total_amount: 3000,
            created_at: '2026-08-20T10:00:00.000Z',
            sales: [{ product_id: 'p9', quantity: 1 }],
        }]);
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-old' }, error: null });

        await syncOfflineSales({ invalidateQueries: vi.fn() });

        expect(rpcMock).toHaveBeenCalledWith('process_sale', expect.objectContaining({
            p_customer_name: 'Ancien Client',
            p_created_at: '2026-08-20T10:00:00.000Z',
            p_items: [{ product_id: 'p9', quantity: 1 }],
        }));
        expect(await get('offline_sales')).toBeUndefined();
    });
});
