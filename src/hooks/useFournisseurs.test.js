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
const { addProductMock } = vi.hoisted(() => ({ addProductMock: vi.fn() }));

vi.mock('../services/productsService', () => ({
    productKeys: { all: (businessId) => ['products', businessId] },
    addProduct: addProductMock,
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
        addProductMock.mockReset();
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

    it('queues a supplier deletion for confirmation without deleting immediately', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

        act(() => result.current.handleDeleteSupplier({ id: 's1', name: 'Import Moto' }));

        expect(result.current.confirmAction).toEqual({ type: 'deleteSupplier', item: { id: 's1', name: 'Import Moto' } });
        expect(deleteSupplierMock).not.toHaveBeenCalled();
    });

    it('deletes a supplier once the pending confirmation is confirmed', async () => {
        deleteSupplierMock.mockResolvedValueOnce('s1');
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

        act(() => result.current.handleDeleteSupplier({ id: 's1', name: 'Import Moto' }));
        await act(async () => result.current.confirmPendingAction());

        expect(deleteSupplierMock.mock.calls[0]?.[0]).toBe('s1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });

    it('discards a pending confirmation when cancelled', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

        act(() => result.current.handleDeleteSupplier({ id: 's1', name: 'Import Moto' }));
        act(() => result.current.closeConfirmAction());

        expect(result.current.confirmAction).toBeNull();
        expect(deleteSupplierMock).not.toHaveBeenCalled();
    });

    it('rejects creating a purchase order with no items', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        // handleCreateOrder est async depuis l'ajout de la création de
        // produit à la volée : ne pas retourner sa promesse à act() (sinon
        // act() passe en mode asynchrone sans être await, ce qui fait
        // déraper le rendu du test suivant).
        act(() => { result.current.handleCreateOrder({ supplierId: '', items: [] }); });

        expect(toastErrorMock).toHaveBeenCalled();
        expect(createPurchaseOrderMock).not.toHaveBeenCalled();
    });

    it('rejects creating a purchase order with an incomplete item', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => { result.current.handleCreateOrder({ supplierId: '', items: [{ productId: '', quantity: 1, unitCost: 100 }] }); });

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

    it('rejects an inline new-product item with no name', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => {
            result.current.handleCreateOrder({
                supplierId: '',
                items: [{ isNew: true, newProduct: { name: '', price: 5000 }, quantity: 2, unitCost: 3000 }],
            });
        });

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addProductMock).not.toHaveBeenCalled();
        expect(createPurchaseOrderMock).not.toHaveBeenCalled();
    });

    it('creates the new product first, then the order with its id', async () => {
        addProductMock.mockResolvedValueOnce({ id: 'p-new' });
        createPurchaseOrderMock.mockResolvedValueOnce({ id: 'po2' });
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        await act(async () => result.current.handleCreateOrder({
            supplierId: 's1',
            items: [{ isNew: true, newProduct: { name: 'Plaquette de frein', price: 5000 }, quantity: 2, unitCost: 3000 }],
        }));

        expect(addProductMock).toHaveBeenCalledWith(expect.objectContaining({
            businessId: 'biz-1', name: 'Plaquette de frein', price: 5000, costPrice: 3000, stockQuantity: 0,
        }));
        expect(createPurchaseOrderMock).toHaveBeenCalledWith({
            businessId: 'biz-1', supplierId: 's1', items: [{ productId: 'p-new', quantity: 2, unitCost: 3000 }],
        });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('shapes an order for the print component', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handlePrintOrder({
            id: 'po1',
            created_at: '2026-09-02T10:00:00.000Z',
            status: 'received',
            supplier: { name: 'Import Moto' },
            total_amount: 6000,
            items: [{ product_name: 'Plaquette de frein', quantity: 2, unit_cost: 3000 }],
        }));

        expect(result.current.orderToPrint).toEqual({
            orderId: 'po1',
            date: '2026-09-02T10:00:00.000Z',
            status: 'received',
            supplier: { name: 'Import Moto' },
            total: 6000,
            items: [{ name: 'Plaquette de frein', quantity: 2, price: 3000 }],
        });
    });

    it('receives a purchase order once the pending confirmation is confirmed', async () => {
        receivePurchaseOrderMock.mockResolvedValueOnce({ id: 'po1', status: 'received' });
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleReceiveOrder({ id: 'po1' }));
        expect(result.current.confirmAction).toEqual({ type: 'receiveOrder', item: { id: 'po1' } });

        await act(async () => result.current.confirmPendingAction());

        // React Query v5 calls mutationFn with a second (context) argument;
        // only the id we passed in actually matters here.
        expect(receivePurchaseOrderMock.mock.calls[0]?.[0]).toBe('po1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });

    it('does not receive when the confirmation is cancelled', async () => {
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleReceiveOrder({ id: 'po1' }));
        act(() => result.current.closeConfirmAction());

        expect(receivePurchaseOrderMock).not.toHaveBeenCalled();
        expect(result.current.confirmAction).toBeNull();
    });

    it('cancels a purchase order once the pending confirmation is confirmed', async () => {
        cancelPurchaseOrderMock.mockResolvedValueOnce('po1');
        const { result } = renderHookWithQueryClient(() => useFournisseurs(BUSINESS));
        await waitFor(() => expect(result.current.purchaseOrders).toHaveLength(1));

        act(() => result.current.handleCancelOrder({ id: 'po1' }));
        await act(async () => result.current.confirmPendingAction());

        expect(cancelPurchaseOrderMock.mock.calls[0]?.[0]).toBe('po1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });
});
