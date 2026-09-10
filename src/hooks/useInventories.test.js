import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useInventories } from './useInventories';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchInventoriesMock, startInventoryMock, deleteInventoryMock } = vi.hoisted(() => ({
    fetchInventoriesMock: vi.fn(),
    startInventoryMock: vi.fn(),
    deleteInventoryMock: vi.fn(),
}));

vi.mock('../services/inventoriesService', () => ({
    fetchInventories: fetchInventoriesMock,
    startInventory: startInventoryMock,
    deleteInventory: deleteInventoryMock,
}));

// productKeys est une simple fabrique de clé de requête, sans effet de
// bord — mais productsService.js importe le vrai client Supabase, qu'on ne
// veut pas charger ici.
vi.mock('../services/productsService', () => ({
    productKeys: { all: (businessId) => ['products', businessId] },
}));

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const BUSINESS = { id: 'biz-1' };

describe('useInventories', () => {
    beforeEach(() => {
        fetchInventoriesMock.mockReset();
        startInventoryMock.mockReset();
        deleteInventoryMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchInventoriesMock.mockResolvedValue([{ id: 'inv1', status: 'draft' }]);
    });

    it('loads the inventories of the current business', async () => {
        const { result } = renderHookWithQueryClient(() => useInventories(BUSINESS));

        await waitFor(() => expect(result.current.inventories).toHaveLength(1));
    });

    it('starts a new inventory and opens it directly for counting', async () => {
        startInventoryMock.mockResolvedValueOnce({ id: 'inv2', status: 'draft' });
        const { result } = renderHookWithQueryClient(() => useInventories(BUSINESS));
        await waitFor(() => expect(result.current.inventories).toHaveLength(1));

        act(() => result.current.openStartForm());
        act(() => result.current.setNote('Septembre'));
        await act(async () => result.current.handleStartInventory({ preventDefault: () => {} }));

        expect(startInventoryMock).toHaveBeenCalledWith({ businessId: 'biz-1', note: 'Septembre' });
        expect(result.current.isStartFormOpen).toBe(false);
        expect(result.current.activeInventory).toEqual({ id: 'inv2', status: 'draft' });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('opens and closes an inventory for counting', async () => {
        const { result } = renderHookWithQueryClient(() => useInventories(BUSINESS));
        await waitFor(() => expect(result.current.inventories).toHaveLength(1));

        act(() => result.current.openInventory({ id: 'inv1', status: 'draft' }));
        expect(result.current.activeInventory).toEqual({ id: 'inv1', status: 'draft' });

        act(() => result.current.closeInventory());
        expect(result.current.activeInventory).toBeNull();
    });

    it('deletes a draft inventory once the pending confirmation is confirmed', async () => {
        deleteInventoryMock.mockResolvedValueOnce('inv1');
        const { result } = renderHookWithQueryClient(() => useInventories(BUSINESS));
        await waitFor(() => expect(result.current.inventories).toHaveLength(1));

        act(() => result.current.handleDeleteInventory({ id: 'inv1' }));
        expect(result.current.confirmAction).toEqual({ type: 'deleteInventory', item: { id: 'inv1' } });

        await act(async () => result.current.confirmPendingAction());

        // React Query v5 appelle mutationFn avec un second argument (contexte) ;
        // seul l'id qu'on a passé nous importe ici.
        expect(deleteInventoryMock.mock.calls[0]?.[0]).toBe('inv1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('does not delete when the confirmation is cancelled', async () => {
        const { result } = renderHookWithQueryClient(() => useInventories(BUSINESS));
        await waitFor(() => expect(result.current.inventories).toHaveLength(1));

        act(() => result.current.handleDeleteInventory({ id: 'inv1' }));
        act(() => result.current.closeConfirmAction());

        expect(deleteInventoryMock).not.toHaveBeenCalled();
        expect(result.current.confirmAction).toBeNull();
    });
});
