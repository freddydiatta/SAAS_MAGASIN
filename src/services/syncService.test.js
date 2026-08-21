import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveOfflineSale, syncOfflineSales } from './syncService';

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

describe('syncOfflineSales', () => {
    beforeEach(() => {
        getMock.mockReset();
        setMock.mockReset();
        rpcMock.mockReset();
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
