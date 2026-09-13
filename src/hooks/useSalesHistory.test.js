import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useSalesHistory } from './useSalesHistory';
import { renderHookWithQueryClient } from '../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { rpcMock, fromMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock, rpc: rpcMock },
}));

const BUSINESS = { id: 'biz-1' };
const RECEIPT = {
    id: 'r1',
    business_id: 'biz-1',
    customer_name: null,
    customer_phone: null,
    total_amount: 1000,
    status: 'completed',
    created_at: '2026-08-20T10:00:00.000Z',
    sales: [
        { id: 's1', product_id: 'p1', quantity: 1, total_price: 1000, products: { name: 'Casque Moto', type: 'moto' } },
    ],
};

describe('useSalesHistory', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        fromMock.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ data: [RECEIPT], error: null }));
    });

    it('fetches receipts for the selected business', async () => {
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));

        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));
        expect(result.current.isLoading).toBe(false);
    });

    it('confirmCancel calls cancel_sale and clears receiptToCancel on success', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...RECEIPT, status: 'cancelled' }, error: null });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.setReceiptToCancel(RECEIPT));
        await act(async () => result.current.confirmCancel());

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('cancel_sale', { p_receipt_id: 'r1' });
        });
        await waitFor(() => expect(result.current.receiptToCancel).toBeNull());
        expect(result.current.toastMessage).toMatch(/annulée avec succès/);
    });

    it('says why an annulation was refused, rather than a generic error', async () => {
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: new Error('Cette vente à crédit a déjà été remboursée : elle ne peut plus être annulée.'),
        });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.setReceiptToCancel(RECEIPT));
        await act(async () => result.current.confirmCancel());

        await waitFor(() => expect(result.current.toastMessage).toMatch(/déjà été remboursée/));
    });

    it('handleModify seeds modifiedItems from the receipt lines, and updateModifiedQty ignores negatives', async () => {
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        expect(result.current.modifiedItems).toEqual([
            { id: 's1', saleId: 's1', product_id: 'p1', name: 'Casque Moto', original_qty: 1, new_qty: 1, price: 1000 },
        ]);

        act(() => result.current.updateModifiedQty('s1', -1));
        expect(result.current.modifiedItems[0].new_qty).toBe(1);

        act(() => result.current.updateModifiedQty('s1', 3));
        expect(result.current.modifiedItems[0].new_qty).toBe(3);
    });

    it('confirmModify sends the updated items through modify_sale', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...RECEIPT, total_amount: 3000 }, error: null });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        act(() => result.current.updateModifiedQty('s1', 3));
        await act(async () => result.current.confirmModify());

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('modify_sale', {
                p_receipt_id: 'r1',
                p_items: [{ sale_id: 's1', product_id: 'p1', new_qty: 3 }],
            });
        });
        await waitFor(() => expect(result.current.receiptToModify).toBeNull());
        expect(result.current.toastMessage).toMatch(/modifiée avec succès/);
    });

    it('lets a returned item be taken off the sale, quantity zero', async () => {
        rpcMock.mockResolvedValueOnce({ data: RECEIPT, error: null });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        act(() => result.current.updateModifiedQty('s1', 0));

        expect(result.current.modifiedItems[0].new_qty).toBe(0);

        await act(async () => result.current.confirmModify());

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('modify_sale', {
                p_receipt_id: 'r1',
                p_items: [{ sale_id: 's1', product_id: 'p1', new_qty: 0 }],
            });
        });
    });

    it('swaps one product for another in a single correction', async () => {
        rpcMock.mockResolvedValueOnce({ data: RECEIPT, error: null });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        // la cliente rend le grand modele et repart avec deux petits
        act(() => result.current.handleModify(RECEIPT));
        act(() => result.current.updateModifiedQty('s1', 0));
        act(() => result.current.addProductToModify({ id: 'p2', name: 'ANANAS PM', price: 350 }));
        act(() => result.current.updateModifiedQty('new-p2', 2));

        await act(async () => result.current.confirmModify());

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('modify_sale', {
                p_receipt_id: 'r1',
                p_items: [
                    { sale_id: 's1', product_id: 'p1', new_qty: 0 },
                    // sale_id null : la ligne n'existe pas encore en base
                    { sale_id: null, product_id: 'p2', new_qty: 2 },
                ],
            });
        });
    });

    it('bumps the quantity instead of duplicating a product already on the sale', async () => {
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        act(() => result.current.addProductToModify({ id: 'p1', name: 'Casque Moto', price: 1000 }));

        expect(result.current.modifiedItems).toHaveLength(1);
        expect(result.current.modifiedItems[0].new_qty).toBe(2);
    });

    it('surfaces the exact reason the correction was refused', async () => {
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: new Error('Stock insuffisant pour "ANANAS PM": disponible 1, demandé 2'),
        });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        act(() => result.current.updateModifiedQty('s1', 3));
        await act(async () => result.current.confirmModify());

        await waitFor(() => expect(result.current.toastMessage).toMatch(/Stock insuffisant pour "ANANAS PM"/));
    });

    it('filters receipts by date range while keeping the unfiltered total available', async () => {
        const today = new Date();
        const oldReceipt = { ...RECEIPT, id: 'r-old', created_at: '2020-01-01T10:00:00.000Z' };
        const recentReceipt = { ...RECEIPT, id: 'r-recent', created_at: today.toISOString() };
        fromMock.mockImplementation(() => createQueryBuilder({ data: [recentReceipt, oldReceipt], error: null }));

        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toHaveLength(2));
        expect(result.current.totalReceiptsCount).toBe(2);

        act(() => result.current.setDateFilter('7d'));

        await waitFor(() => expect(result.current.receipts).toEqual([recentReceipt]));
        // the unfiltered total doesn't change just because a filter is applied
        expect(result.current.totalReceiptsCount).toBe(2);
    });

    it('handlePrint maps a receipt into per-unit-price print details', async () => {
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handlePrint(RECEIPT));

        expect(result.current.receiptToPrint).toEqual({
            receiptId: 'r1',
            date: RECEIPT.created_at,
            customerName: null,
            customerPhone: null,
            items: [{ name: 'Casque Moto', quantity: 1, price: 1000 }],
            total: 1000,
        });
    });
});
