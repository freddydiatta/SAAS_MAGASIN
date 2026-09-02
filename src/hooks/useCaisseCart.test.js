import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useCaisseCart } from './useCaisseCart';
import { renderHookWithQueryClient } from '../test/testUtils';

function createDebtsInsertBuilder(result) {
    const builder = {
        insert: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { rpcMock, saveOfflineSaleMock, fromMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    saveOfflineSaleMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: { rpc: rpcMock, from: fromMock },
}));

vi.mock('../services/syncService', () => ({
    saveOfflineSale: saveOfflineSaleMock,
}));

const BUSINESS = { id: 'biz-1' };
const PRODUCT = { id: 'p1', name: 'Casque Moto', type: 'moto', price: 1000 };

describe('useCaisseCart', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

    beforeEach(() => {
        rpcMock.mockReset();
        saveOfflineSaleMock.mockReset();
        fromMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    it('adds a product, bumps quantity on a second add, and computes the cart total', () => {
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));

        act(() => result.current.addToCart(PRODUCT));
        expect(result.current.cart).toEqual([{ ...PRODUCT, quantity: 1 }]);

        act(() => result.current.addToCart(PRODUCT));
        expect(result.current.cart).toEqual([{ ...PRODUCT, quantity: 2 }]);
        expect(result.current.cartTotal).toBe(2000);
    });

    it('updateQuantity ignores values below 1', () => {
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));

        act(() => result.current.updateQuantity('p1', 0));
        expect(result.current.cart[0].quantity).toBe(1);

        act(() => result.current.updateQuantity('p1', 5));
        expect(result.current.cart[0].quantity).toBe(5);
    });

    it('removeFromCart drops the item', () => {
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));
        act(() => result.current.removeFromCart('p1'));
        expect(result.current.cart).toEqual([]);
    });

    it('checks out online through the atomic process_sale RPC and resets the cart', async () => {
        rpcMock.mockResolvedValueOnce({ data: { id: 'receipt-1', total_amount: 1000 }, error: null });
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));

        await act(async () => {
            await result.current.handleCheckout(false);
        });

        expect(rpcMock).toHaveBeenCalledWith('process_sale', {
            p_business_id: 'biz-1',
            p_customer_name: null,
            p_customer_phone: null,
            p_payment_method: 'cash',
            p_items: [{ product_id: 'p1', quantity: 1 }],
        });
        expect(result.current.cart).toEqual([]);
        expect(result.current.toastMessage).toMatch(/encaissée avec succès/);
    });

    it('keeps the cart and surfaces a toast when process_sale rejects', async () => {
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Stock insuffisant') });
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));

        await act(async () => {
            await result.current.handleCheckout(false);
        });

        expect(result.current.cart).toEqual([{ ...PRODUCT, quantity: 1 }]);
        expect(result.current.toastMessage).toMatch(/Erreur lors de l'encaissement/);
    });

    it('queues the sale offline via saveOfflineSale when there is no connection', async () => {
        onlineSpy.mockReturnValue(false);
        saveOfflineSaleMock.mockResolvedValueOnce({ id: 'temp-1', sales: [] });
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));

        await act(async () => {
            await result.current.handleCheckout(false);
        });

        expect(saveOfflineSaleMock).toHaveBeenCalledWith('biz-1', [{ ...PRODUCT, quantity: 1 }], '', '', 1000, 'cash');
        expect(rpcMock).not.toHaveBeenCalled();
        expect(result.current.cart).toEqual([]);
        expect(result.current.toastMessage).toMatch(/enregistrée hors-ligne/);
    });

    it('handleFacturationSubmit blocks checkout when the customer phone is invalid', async () => {
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));
        act(() => result.current.setCustomerPhone('not-a-phone!!'));

        act(() => result.current.handleFacturationSubmit());

        expect(rpcMock).not.toHaveBeenCalled();
        expect(result.current.toastMessage).toMatch(/invalide/);
        // cart untouched since checkout never ran
        expect(result.current.cart).toEqual([{ ...PRODUCT, quantity: 1 }]);
    });

    it('handleFacturationSubmit proceeds to checkout and shows the invoice when valid', async () => {
        rpcMock.mockResolvedValueOnce({ data: { id: 'receipt-1', total_amount: 1000 }, error: null });
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));
        act(() => result.current.setCustomerName('Jean'));
        act(() => result.current.setCustomerPhone('771234567'));

        await act(async () => {
            result.current.handleFacturationSubmit();
            await waitFor(() => expect(rpcMock).toHaveBeenCalled());
        });

        expect(result.current.showInvoice).toBe(true);
        expect(result.current.lastSaleDetails).toMatchObject({ receiptId: 'receipt-1', customerName: 'Jean' });
    });

    it('blocks a credit checkout with no customer name', async () => {
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));
        act(() => result.current.setPaymentMethod('credit'));

        await act(async () => {
            await result.current.handleCheckout(false);
        });

        expect(rpcMock).not.toHaveBeenCalled();
        expect(result.current.toastMessage).toMatch(/nom du client est requis/);
        expect(result.current.cart).toEqual([{ ...PRODUCT, quantity: 1 }]);
    });

    it('records a debt for the sale amount after a successful credit checkout', async () => {
        rpcMock.mockResolvedValueOnce({ data: { id: 'receipt-1', total_amount: 1000 }, error: null });
        const debtsBuilder = createDebtsInsertBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => debtsBuilder);
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));
        act(() => result.current.setPaymentMethod('credit'));
        act(() => result.current.setCustomerName('Moussa Diop'));

        await act(async () => {
            await result.current.handleCheckout(false);
        });

        expect(rpcMock).toHaveBeenCalledWith('process_sale', expect.objectContaining({
            p_customer_name: 'Moussa Diop',
            p_payment_method: 'credit',
        }));
        expect(fromMock).toHaveBeenCalledWith('debts');
        expect(debtsBuilder.insert).toHaveBeenCalledWith([expect.objectContaining({
            customer_name: 'Moussa Diop',
            amount: 1000,
        })]);
        expect(result.current.toastMessage).toMatch(/vente à crédit enregistrée/i);
        expect(result.current.cart).toEqual([]);
    });

    it('warns but does not fail the sale when debt registration fails after a credit checkout', async () => {
        rpcMock.mockResolvedValueOnce({ data: { id: 'receipt-1', total_amount: 1000 }, error: null });
        const debtsBuilder = createDebtsInsertBuilder({ data: null, error: new Error('network down') });
        fromMock.mockImplementation(() => debtsBuilder);
        const { result } = renderHookWithQueryClient(() => useCaisseCart(BUSINESS));
        act(() => result.current.addToCart(PRODUCT));
        act(() => result.current.setPaymentMethod('credit'));
        act(() => result.current.setCustomerName('Moussa Diop'));

        await act(async () => {
            await result.current.handleCheckout(false);
        });

        expect(result.current.toastMessage).toMatch(/dette n'a pas pu être enregistrée/);
        // La vente elle-même n'est pas annulée : le panier est bien vidé.
        expect(result.current.cart).toEqual([]);
    });
});
