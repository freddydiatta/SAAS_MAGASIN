import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useFournisseurs } from './useFournisseurs';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchSuppliersMock, addSupplierMock, deleteSupplierMock } = vi.hoisted(() => ({
    fetchSuppliersMock: vi.fn(),
    addSupplierMock: vi.fn(),
    deleteSupplierMock: vi.fn(),
}));

vi.mock('../services/suppliersService', () => ({
    fetchSuppliers: fetchSuppliersMock,
    addSupplier: addSupplierMock,
    deleteSupplier: deleteSupplierMock,
}));

const { fetchPurchaseOrdersMock, createPurchaseOrderMock, receivePurchaseOrderMock, cancelPurchaseOrderMock } = vi.hoisted(() => ({
    fetchPurchaseOrdersMock: vi.fn(),
    createPurchaseOrderMock: vi.fn(),
    receivePurchaseOrderMock: vi.fn(),
    cancelPurchaseOrderMock: vi.fn(),
}));

vi.mock('../services/purchaseOrdersService', () => ({
    fetchPurchaseOrders: fetchPurchaseOrdersMock,
    createPurchaseOrder: createPurchaseOrderMock,
    receivePurchaseOrder: receivePurchaseOrderMock,
    cancelPurchaseOrder: cancelPurchaseOrderMock,
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

describe('useFournisseurs', () => {
    beforeEach(() => {
        fetchSuppliersMock.mockReset();
        addSupplierMock.mockReset();
        deleteSupplierMock.mockReset();
        fetchPurchaseOrdersMock.mockReset();
        createPurchaseOrderMock.mockReset();
        receivePurchaseOrderMock.mockReset();
        cancelPurchaseOrderMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchSuppliersMock.mockResolvedValue([{ id: 's1', name: 'Import Moto' }]);
        fetchPurchaseOrdersMock.mockResolvedValue([{ id: 'po1', status: 'pending' }]);
    });

    it('loads suppliers and purchase orders', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));

        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));
        expect(result.current.purchaseOrders).toHaveLength(1);
    });

    it('rejects a supplier submission with a blank name', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

        act(() => result.current.setSupplierForm({ name: '', contactName: '', phone: '', email: '' }));
        act(() => result.current.handleSupplierSubmit({ preventDefault: () => {} }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addSupplierMock).not.toHaveBeenCalled();
    });

    it('submits a valid supplier', async () => {
        addSupplierMock.mockResolvedValueOnce();
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

        act(() => result.current.setSupplierForm({ name: 'Import Moto 2', contactName: '', phone: '', email: '' }));
        await act(async () => result.current.handleSupplierSubmit({ preventDefault: () => {} }));

        expect(addSupplierMock).toHaveBeenCalledWith({ businessId: 'biz-1', name: 'Import Moto 2', contactName: '', phone: '', email: '' });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('deletes a supplier only after confirmation', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

        act(() => result.current.handleDeleteSupplier({ id: 's1', name: 'Import Moto' }));

        expect(deleteSupplierMock).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('rejects creating a purchase order with no items', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleCreateOrder({ supplierId: '', items: [] }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(createPurchaseOrderMock).not.toHaveBeenCalled();
    });

    it('rejects creating a purchase order with an incomplete item', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleCreateOrder({ supplierId: '', items: [{ productId: '', quantity: 1, unitCost: 100 }] }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(createPurchaseOrderMock).not.toHaveBeenCalled();
    });

    it('creates a valid purchase order', async () => {
        createPurchaseOrderMock.mockResolvedValueOnce({ id: 'po2' });
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        await act(async () => result.current.handleCreateOrder({
            supplierId: 's1',
            items: [{ productId: 'p1', quantity: 2, unitCost: 500 }],
        }));

        expect(createPurchaseOrderMock).toHaveBeenCalledWith({
            businessId: 'biz-1', supplierId: 's1', items: [{ productId: 'p1', quantity: 2, unitCost: 500 }],
        });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('receives a purchase order after confirmation', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        receivePurchaseOrderMock.mockResolvedValueOnce({ id: 'po1', status: 'received' });
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleReceiveOrder({ id: 'po1' }));

        // React Query v5 calls mutationFn with a second (context) argument;
        // only the id we passed in actually matters here.
        await waitFor(() => expect(receivePurchaseOrderMock.mock.calls[0]?.[0]).toBe('po1'));
        confirmSpy.mockRestore();
    });

    it('does not receive when the confirmation is cancelled', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleReceiveOrder({ id: 'po1' }));

        expect(receivePurchaseOrderMock).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('cancels a purchase order after confirmation', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        cancelPurchaseOrderMock.mockResolvedValueOnce('po1');
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleCancelOrder({ id: 'po1' }));

        await waitFor(() => expect(cancelPurchaseOrderMock.mock.calls[0]?.[0]).toBe('po1'));
        confirmSpy.mockRestore();
    });
});
