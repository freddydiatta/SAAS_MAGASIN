import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder, unreceivePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder } from './purchaseOrdersService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        update: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock, rpc: rpcMock },
}));

describe('purchaseOrdersService', () => {
    beforeEach(() => {
        fromMock.mockReset();
        rpcMock.mockReset();
    });

    it('fetchPurchaseOrders joins the supplier and items, most recent first', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'po1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchPurchaseOrders('biz-1');

        expect(fromMock).toHaveBeenCalledWith('purchase_orders');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(data).toEqual([{ id: 'po1' }]);
    });

    it('createPurchaseOrder maps items to the snake_case RPC shape', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'po1' }, error: null });

        await createPurchaseOrder({
            businessId: 'biz-1',
            supplierId: 's1',
            items: [{ productId: 'p1', quantity: 5, unitCost: 300 }],
        });

        expect(rpcMock).toHaveBeenCalledWith('create_purchase_order', {
            p_business_id: 'biz-1',
            p_supplier_id: 's1',
            p_items: [{ product_id: 'p1', quantity: 5, unit_cost: 300 }],
        });
    });

    it('createPurchaseOrder passes a null supplier when none was selected', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'po1' }, error: null });

        await createPurchaseOrder({ businessId: 'biz-1', supplierId: '', items: [{ productId: 'p1', quantity: 1, unitCost: 100 }] });

        expect(rpcMock).toHaveBeenCalledWith('create_purchase_order', expect.objectContaining({ p_supplier_id: null }));
    });

    it('propagates a database error from createPurchaseOrder', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Produit introuvable') });

        await expect(createPurchaseOrder({ businessId: 'biz-1', supplierId: '', items: [] })).rejects.toThrow('Produit introuvable');
    });

    it('updatePurchaseOrder maps items to the snake_case RPC shape', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'po1' }, error: null });

        await updatePurchaseOrder({
            orderId: 'po1',
            supplierId: 's1',
            items: [{ productId: 'p1', quantity: 5, unitCost: 300 }],
        });

        expect(rpcMock).toHaveBeenCalledWith('update_purchase_order', {
            p_order_id: 'po1',
            p_supplier_id: 's1',
            p_items: [{ product_id: 'p1', quantity: 5, unit_cost: 300 }],
        });
    });

    it('updatePurchaseOrder passes a null supplier when none was selected', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'po1' }, error: null });

        await updatePurchaseOrder({ orderId: 'po1', supplierId: '', items: [{ productId: 'p1', quantity: 1, unitCost: 100 }] });

        expect(rpcMock).toHaveBeenCalledWith('update_purchase_order', expect.objectContaining({ p_supplier_id: null }));
    });

    it('propagates a database error from updatePurchaseOrder (e.g. order already received)', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Seul un bon de commande en attente peut être modifié.') });

        await expect(updatePurchaseOrder({ orderId: 'po1', supplierId: '', items: [] }))
            .rejects.toThrow('Seul un bon de commande en attente peut être modifié.');
    });

    it('receivePurchaseOrder calls the RPC with the order id', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'po1', status: 'received' }, error: null });

        const result = await receivePurchaseOrder('po1');

        expect(rpcMock).toHaveBeenCalledWith('receive_purchase_order', { p_purchase_order_id: 'po1' });
        expect(result).toEqual({ id: 'po1', status: 'received' });
    });

    it('cancelPurchaseOrder only updates a still-pending order', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await cancelPurchaseOrder('po1');

        expect(builder.update).toHaveBeenCalledWith({ status: 'cancelled' });
        expect(builder.eq).toHaveBeenCalledWith('id', 'po1');
        expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('unreceivePurchaseOrder calls the RPC with the order id', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'po1', status: 'pending' }, error: null });

        const result = await unreceivePurchaseOrder({ orderId: 'po1' });

        expect(rpcMock).toHaveBeenCalledWith('unreceive_purchase_order', { p_purchase_order_id: 'po1' });
        expect(result).toEqual({ id: 'po1', status: 'pending' });
    });

    it('propagates a database error from unreceivePurchaseOrder (e.g. stock already resold)', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Impossible d\'annuler la réception : stock actuel de "Casque Moto" insuffisant (disponible 1, à retirer 3)') });

        await expect(unreceivePurchaseOrder({ orderId: 'po1' }))
            .rejects.toThrow('stock actuel de "Casque Moto" insuffisant');
    });

    it('deletePurchaseOrder calls the RPC with the order id', async () => {
        rpcMock.mockResolvedValue({ data: null, error: null });

        const result = await deletePurchaseOrder({ orderId: 'po1' });

        expect(rpcMock).toHaveBeenCalledWith('delete_purchase_order', { p_purchase_order_id: 'po1' });
        expect(result).toBe('po1');
    });

    it('propagates a database error from deletePurchaseOrder (e.g. order already received)', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Un bon de commande reçu ne peut pas être supprimé') });

        await expect(deletePurchaseOrder({ orderId: 'po1' }))
            .rejects.toThrow('Un bon de commande reçu ne peut pas être supprimé');
    });
});
