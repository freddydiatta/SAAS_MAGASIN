import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useRestaurantOrders } from './useRestaurantOrders';
import { renderHookWithQueryClient } from '../test/testUtils';

// A fresh builder per `.from()` call, since the same fromMock serves the
// initial list fetch, the mutation, and the refetch that invalidateOrders()
// triggers afterwards — a single shared/stateful builder would leak the
// `.single()` flag from the insert path into that unrelated refetch.
// insertSpy/updateSpy let assertions inspect calls across those instances.
function createQueryBuilder({ list, single, insertSpy, updateSpy } = {}) {
    let isSingle = false;
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn((...args) => { insertSpy?.(...args); return builder; }),
        update: vi.fn((...args) => { updateSpy?.(...args); return builder; }),
        single: vi.fn(() => { isSingle = true; return builder; }),
        then: (resolve, reject) => Promise.resolve(isSingle ? single : list).then(resolve, reject),
    };
    return builder;
}

const { fromMock, toastSuccess, toastError } = vi.hoisted(() => ({
    fromMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccess, error: toastError },
}));

const BUSINESS = { id: 'biz-1' };
const ORDERS = [
    { id: 'o1', business_id: 'biz-1', table_number: '4', status: 'pending', total_amount: 5000, items: [{ name: 'Thieb', quantity: 2 }] },
    { id: 'o2', business_id: 'biz-1', table_number: '2', status: 'served', total_amount: 3000, items: [{ name: 'Yassa', quantity: 1 }] },
    { id: 'o3', business_id: 'biz-1', table_number: '1', status: 'paid', total_amount: 2000, items: [{ name: 'Soda', quantity: 1 }] },
];

describe('useRestaurantOrders', () => {
    beforeEach(() => {
        fromMock.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ list: { data: ORDERS, error: null } }));
    });

    it('fetches orders and derives activeOrders as pending or served only', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantOrders(BUSINESS));

        await waitFor(() => expect(result.current.orders).toEqual(ORDERS));
        expect(result.current.activeOrders.map(o => o.id)).toEqual(['o1', 'o2']);
    });

    it('createOrder inserts a pending order and shows a success toast', async () => {
        const insertSpy = vi.fn();
        fromMock.mockImplementation(() => createQueryBuilder({
            list: { data: ORDERS, error: null },
            single: { data: { ...ORDERS[0], id: 'o4' }, error: null },
            insertSpy,
        }));
        const { result } = renderHookWithQueryClient(() => useRestaurantOrders(BUSINESS));
        await waitFor(() => expect(result.current.loadingOrders).toBe(false));

        act(() => result.current.createOrder({ tableNumber: '7', total: 4500, items: [{ name: 'Mafe', quantity: 1 }] }));

        await waitFor(() => {
            expect(insertSpy).toHaveBeenCalledWith([{
                business_id: 'biz-1', table_number: '7', total_amount: 4500, status: 'pending', items: [{ name: 'Mafe', quantity: 1 }],
            }]);
        });
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Commande envoyée en cuisine !'));
    });

    it('createOrder defaults the table number to "À emporter" when none is given', async () => {
        const insertSpy = vi.fn();
        fromMock.mockImplementation(() => createQueryBuilder({
            list: { data: ORDERS, error: null },
            single: { data: { ...ORDERS[0], id: 'o5' }, error: null },
            insertSpy,
        }));
        const { result } = renderHookWithQueryClient(() => useRestaurantOrders(BUSINESS));
        await waitFor(() => expect(result.current.loadingOrders).toBe(false));

        act(() => result.current.createOrder({ total: 1500, items: [] }));

        await waitFor(() => {
            expect(insertSpy).toHaveBeenCalledWith([expect.objectContaining({ table_number: 'À emporter' })]);
        });
    });

    it('setOrderStatus updates the status and shows a translated success toast', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantOrders(BUSINESS));
        await waitFor(() => expect(result.current.orders).toEqual(ORDERS));

        const updateSpy = vi.fn();
        fromMock.mockImplementation(() => createQueryBuilder({ list: { data: ORDERS, error: null }, updateSpy }));

        act(() => result.current.setOrderStatus('o1', 'served'));

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith({ status: 'served' });
        });
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Commande marquée servie.'));
    });

    it('setOrderStatus shows an error toast when the update fails', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantOrders(BUSINESS));
        await waitFor(() => expect(result.current.orders).toEqual(ORDERS));

        fromMock.mockImplementation(() => createQueryBuilder({ list: { data: null, error: new Error('boom') } }));

        act(() => result.current.setOrderStatus('o1', 'paid'));

        await waitFor(() => expect(toastError).toHaveBeenCalledWith('Erreur lors de la mise à jour de la commande.'));
    });
});
