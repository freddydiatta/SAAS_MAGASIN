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
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS, 'caissier@test.com'));

        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));
        expect(result.current.isLoading).toBe(false);
    });

    it('confirmCancel calls cancel_sale and clears receiptToCancel on success', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...RECEIPT, status: 'cancelled' }, error: null });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS, 'caissier@test.com'));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.setReceiptToCancel(RECEIPT));
        await act(async () => result.current.confirmCancel());

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('cancel_sale', { p_receipt_id: 'r1', p_user_email: 'caissier@test.com' });
        });
        await waitFor(() => expect(result.current.receiptToCancel).toBeNull());
        expect(result.current.toastMessage).toMatch(/annulée avec succès/);
    });

    it('shows an error toast when cancel_sale rejects', async () => {
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Déjà annulée') });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS, 'caissier@test.com'));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.setReceiptToCancel(RECEIPT));
        await act(async () => result.current.confirmCancel());

        await waitFor(() => expect(result.current.toastMessage).toMatch(/erreur est survenue lors de l'annulation/));
    });

    it('handleModify seeds modifiedItems from the receipt lines, and updateModifiedQty ignores negatives', async () => {
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS, 'caissier@test.com'));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        expect(result.current.modifiedItems).toEqual([
            { id: 's1', product_id: 'p1', name: 'Casque Moto', original_qty: 1, new_qty: 1, price: 1000 },
        ]);

        act(() => result.current.updateModifiedQty('s1', -1));
        expect(result.current.modifiedItems[0].new_qty).toBe(1);

        act(() => result.current.updateModifiedQty('s1', 3));
        expect(result.current.modifiedItems[0].new_qty).toBe(3);
    });

    it('confirmModify sends the updated items through modify_sale', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...RECEIPT, total_amount: 3000 }, error: null });
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS, 'caissier@test.com'));
        await waitFor(() => expect(result.current.receipts).toEqual([RECEIPT]));

        act(() => result.current.handleModify(RECEIPT));
        act(() => result.current.updateModifiedQty('s1', 3));
        await act(async () => result.current.confirmModify());

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('modify_sale', {
                p_receipt_id: 'r1',
                p_user_email: 'caissier@test.com',
                p_items: [{ sale_id: 's1', product_id: 'p1', name: 'Casque Moto', original_qty: 1, new_qty: 3, price: 1000 }],
            });
        });
        await waitFor(() => expect(result.current.receiptToModify).toBeNull());
        expect(result.current.toastMessage).toMatch(/modifiée avec succès/);
    });

    it('handlePrint maps a receipt into per-unit-price print details', async () => {
        const { result } = renderHookWithQueryClient(() => useSalesHistory(BUSINESS, 'caissier@test.com'));
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
