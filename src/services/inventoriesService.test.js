import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fetchInventories, fetchInventoryItems, startInventory,
    saveInventoryCounts, validateInventory, deleteInventory,
} from './inventoriesService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock, rpc: rpcMock },
}));

describe('inventoriesService', () => {
    beforeEach(() => {
        fromMock.mockReset();
        rpcMock.mockReset();
    });

    it('fetchInventories lists the business inventories, most recent first', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'inv1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchInventories('biz-1');

        expect(fromMock).toHaveBeenCalledWith('inventories');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(data).toEqual([{ id: 'inv1' }]);
    });

    it('fetchInventoryItems lists the items of one inventory', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'item1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchInventoryItems('inv1');

        expect(fromMock).toHaveBeenCalledWith('inventory_items');
        expect(builder.eq).toHaveBeenCalledWith('inventory_id', 'inv1');
        expect(data).toEqual([{ id: 'item1' }]);
    });

    it('startInventory calls the RPC with the business, author and optional note', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'inv1', status: 'draft' }, error: null });

        const result = await startInventory({ businessId: 'biz-1', userEmail: 'gerant@test.com', note: 'Septembre' });

        expect(rpcMock).toHaveBeenCalledWith('start_inventory', {
            p_business_id: 'biz-1', p_user_email: 'gerant@test.com', p_note: 'Septembre',
        });
        expect(result).toEqual({ id: 'inv1', status: 'draft' });
    });

    it('startInventory passes a null note when none was given', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'inv1' }, error: null });

        await startInventory({ businessId: 'biz-1', userEmail: 'gerant@test.com', note: '' });

        expect(rpcMock).toHaveBeenCalledWith('start_inventory', expect.objectContaining({ p_note: null }));
    });

    it('saveInventoryCounts updates each item in parallel', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await saveInventoryCounts([
            { id: 'item1', countedQuantity: 5 },
            { id: 'item2', countedQuantity: null },
        ]);

        expect(fromMock).toHaveBeenCalledWith('inventory_items');
        expect(builder.update).toHaveBeenCalledWith({ counted_quantity: 5 });
        expect(builder.update).toHaveBeenCalledWith({ counted_quantity: null });
        expect(builder.eq).toHaveBeenCalledWith('id', 'item1');
        expect(builder.eq).toHaveBeenCalledWith('id', 'item2');
    });

    it('saveInventoryCounts propagates a database error', async () => {
        const builder = createQueryBuilder({ data: null, error: new Error('boom') });
        fromMock.mockImplementation(() => builder);

        await expect(saveInventoryCounts([{ id: 'item1', countedQuantity: 5 }])).rejects.toThrow('boom');
    });

    it('validateInventory calls the RPC with the inventory id and author email', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'inv1', status: 'validated' }, error: null });

        const result = await validateInventory({ inventoryId: 'inv1', userEmail: 'gerant@test.com' });

        expect(rpcMock).toHaveBeenCalledWith('validate_inventory', { p_inventory_id: 'inv1', p_user_email: 'gerant@test.com' });
        expect(result).toEqual({ id: 'inv1', status: 'validated' });
    });

    it('propagates a database error from validateInventory (e.g. nothing counted)', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Comptez au moins un article avant de valider l\'inventaire.') });

        await expect(validateInventory({ inventoryId: 'inv1', userEmail: 'gerant@test.com' }))
            .rejects.toThrow('Comptez au moins un article');
    });

    it('deleteInventory only deletes a still-draft inventory', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await deleteInventory('inv1');

        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('id', 'inv1');
        expect(builder.eq).toHaveBeenCalledWith('status', 'draft');
    });
});
