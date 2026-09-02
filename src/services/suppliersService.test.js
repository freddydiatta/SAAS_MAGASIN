import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSuppliers, addSupplier, deleteSupplier } from './suppliersService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

describe('suppliersService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('fetchSuppliers orders alphabetically by name', async () => {
        const builder = createQueryBuilder({ data: [{ id: 's1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchSuppliers('biz-1');

        expect(fromMock).toHaveBeenCalledWith('suppliers');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('name');
        expect(data).toEqual([{ id: 's1' }]);
    });

    it('addSupplier defaults blank optional fields to null', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addSupplier({ businessId: 'biz-1', name: 'Import Moto', contactName: '', phone: '', email: '' });

        expect(builder.insert).toHaveBeenCalledWith([{
            business_id: 'biz-1', name: 'Import Moto', contact_name: null, phone: null, email: null,
        }]);
    });

    it('deleteSupplier removes the row by id', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        const id = await deleteSupplier('s1');

        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('id', 's1');
        expect(id).toBe('s1');
    });

    it('propagates a database error from addSupplier', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));

        await expect(addSupplier({ businessId: 'biz-1', name: 'x' })).rejects.toThrow('boom');
    });
});
