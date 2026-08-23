import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveOfflineSale, syncOfflineSales, getOfflineSalesCount } from './syncService';

const { getMock, setMock } = vi.hoisted(() => ({
    getMock: vi.fn(),
    setMock: vi.fn(),
}));

vi.mock('idb-keyval', () => ({
    get: getMock,
    set: setMock,
}));

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { rpc: rpcMock },
}));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    default: { error: toastErrorMock, success: toastSuccessMock },
}));

const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

describe('saveOfflineSale', () => {
    beforeEach(() => {
        getMock.mockReset();
        setMock.mockReset();
    });

    it('queues a receipt with line items derived from the cart', async () => {
        getMock.mockResolvedValueOnce([]);

        const cart = [{ id: 'p1', name: 'Casque', type: 'moto', price: 1000, quantity: 2 }];
        const receipt = await saveOfflineSale('biz-1', cart, 'Client Test', '77000', 2000, 'cash');

        expect(receipt.business_id).toBe('biz-1');
        expect(receipt.total_amount).toBe(2000);
        expect(receipt.sales).toHaveLength(1);
        expect(receipt.sales[0]).toMatchObject({ product_id: 'p1', quantity: 2, total_price: 2000 });

        expect(setMock).toHaveBeenCalledWith('offline_sales', [receipt]);
    });

    it('appends to any sales already queued', async () => {
        const existing = { id: 'temp-existing', sales: [] };
        getMock.mockResolvedValueOnce([existing]);

        const cart = [{ id: 'p1', name: 'Casque', price: 500, quantity: 1 }];
        await saveOfflineSale('biz-1', cart, '', '', 500, 'cash');

        const [, queued] = setMock.mock.calls[0];
        expect(queued).toHaveLength(2);
        expect(queued[0]).toBe(existing);
    });
});

describe('getOfflineSalesCount', () => {
    beforeEach(() => {
        getMock.mockReset();
    });

    it('returns the number of queued receipts', async () => {
        getMock.mockResolvedValueOnce([{ id: 'temp-1' }, { id: 'temp-2' }]);
        await expect(getOfflineSalesCount()).resolves.toBe(2);
    });

    it('returns 0 when nothing is queued yet', async () => {
        getMock.mockResolvedValueOnce(undefined);
        await expect(getOfflineSalesCount()).resolves.toBe(0);
    });
});

describe('syncOfflineSales', () => {
    beforeEach(() => {
        getMock.mockReset();
        setMock.mockReset();
        rpcMock.mockReset();
        toastErrorMock.mockReset();
        toastSuccessMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    it('does nothing when the browser is offline', async () => {
        onlineSpy.mockReturnValue(false);

        await syncOfflineSales();

        expect(getMock).not.toHaveBeenCalled();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('does nothing when there is no queued sale', async () => {
        getMock.mockResolvedValueOnce([]);

        await syncOfflineSales();

        expect(rpcMock).not.toHaveBeenCalled();
        expect(setMock).not.toHaveBeenCalled();
    });

    it('replays each queued receipt through process_sale, preserving its original date', async () => {
        const receipt = {
            id: 'temp-1',
            business_id: 'biz-1',
            customer_name: 'Client',
            customer_phone: '77000',
            payment_method: 'mobile_money',
            created_at: '2026-08-20T10:00:00.000Z',
            sales: [{ product_id: 'p1', quantity: 3 }],
        };
        getMock.mockResolvedValueOnce([receipt]);
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-receipt-1' }, error: null });

        const queryClient = { invalidateQueries: vi.fn() };
        await syncOfflineSales(queryClient);

        expect(rpcMock).toHaveBeenCalledWith('process_sale', {
            p_business_id: 'biz-1',
            p_customer_name: 'Client',
            p_customer_phone: '77000',
            p_payment_method: 'mobile_money',
            p_items: [{ product_id: 'p1', quantity: 3 }],
            p_created_at: '2026-08-20T10:00:00.000Z',
        });

        // fully synced -> queue emptied, dashboards refreshed
        expect(setMock).toHaveBeenCalledWith('offline_sales', []);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['receipts']);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['products']);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['sales']);
    });

    it('invalidates products/sales even when nothing succeeded, to correct optimistic stock from the failed queue', async () => {
        // saveOfflineSale decremented the locally-cached stock optimistically
        // when the sale was first queued, before any server confirmation. If
        // sync fails outright (e.g. another device already sold the same
        // stock while this one was offline), that optimistic number is wrong
        // and must be corrected from the real server state — not just left
        // stale until the next 15s poll.
        const failingReceipt = { id: 'temp-fail', business_id: 'biz-1', sales: [{ product_id: 'p1', quantity: 1 }] };
        getMock.mockResolvedValueOnce([failingReceipt]);
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Stock insuffisant') });

        const queryClient = { invalidateQueries: vi.fn() };
        await syncOfflineSales(queryClient);

        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['offlineSalesPending']);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['products']);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['sales']);
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['receipts']);
    });

    it('names the customer and the server error in the failure toast, so the cashier can act on it', async () => {
        const receipt = {
            id: 'temp-fail', business_id: 'biz-1', customer_name: 'Jean Dupont',
            sales: [{ product_id: 'p1', quantity: 2, products: { name: 'Casque Moto' } }],
        };
        getMock.mockResolvedValueOnce([receipt]);
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: new Error('Stock insuffisant pour "Casque Moto": disponible 0, demandé 2'),
        });

        await syncOfflineSales();

        expect(toastErrorMock).toHaveBeenCalledWith(
            '❌ Vente à Jean Dupont non synchronisée : Stock insuffisant pour "Casque Moto": disponible 0, demandé 2',
            expect.objectContaining({ duration: 10000 })
        );
    });

    it('falls back to a walk-in-customer label when the failed receipt has no name', async () => {
        const receipt = { id: 'temp-fail', business_id: 'biz-1', customer_name: null, sales: [{ product_id: 'p1', quantity: 1 }] };
        getMock.mockResolvedValueOnce([receipt]);
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') });

        await syncOfflineSales();

        expect(toastErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('Vente (client comptoir) non synchronisée : boom'),
            expect.anything()
        );
    });

    it('ignores a concurrent call while a sync is already in flight', async () => {
        // isSyncing is set synchronously before syncOfflineSales' first await,
        // so calling it a second time before the first call is awaited hits
        // the guard immediately — no need to fake a slow network round-trip.
        const receipt = { id: 'temp-1', business_id: 'biz-1', sales: [{ product_id: 'p1', quantity: 1 }] };
        getMock.mockResolvedValueOnce([receipt]);
        rpcMock.mockResolvedValueOnce({ data: { id: 'real-1' }, error: null });

        const first = syncOfflineSales();
        const second = syncOfflineSales(); // lock already held -> no-op

        await Promise.all([first, second]);

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('keeps only the receipts that actually failed, regardless of order', async () => {
        const okReceipt = { id: 'temp-ok', business_id: 'biz-1', sales: [{ product_id: 'p1', quantity: 1 }] };
        const failingReceipt = { id: 'temp-fail', business_id: 'biz-1', sales: [{ product_id: 'p2', quantity: 1 }] };

        // The failure happens FIRST in the queue — this is the case the old
        // slice(syncedCount) logic got wrong (it would have kept okReceipt
        // and silently dropped failingReceipt).
        getMock.mockResolvedValueOnce([failingReceipt, okReceipt]);
        rpcMock
            .mockResolvedValueOnce({ data: null, error: new Error('Stock insuffisant') })
            .mockResolvedValueOnce({ data: { id: 'real-2' }, error: null });

        await syncOfflineSales();

        expect(setMock).toHaveBeenCalledWith('offline_sales', [failingReceipt]);
    });
});
