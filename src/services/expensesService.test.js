import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExpenses, addExpense, deleteExpense } from './expensesService';

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

describe('expensesService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('fetchExpenses orders by most recent first', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'e1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchExpenses('biz-1');

        expect(fromMock).toHaveBeenCalledWith('expenses');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(data).toEqual([{ id: 'e1' }]);
    });

    it('addExpense defaults an empty label to null and attributes createdBy', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addExpense({ businessId: 'biz-1', category: 'transport', label: '', amount: 500, createdBy: 'owner@test.com' });

        expect(builder.insert).toHaveBeenCalledWith([{
            business_id: 'biz-1', category: 'transport', label: null, amount: 500, created_by: 'owner@test.com',
        }]);
    });

    it('deleteExpense removes the row by id', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        const id = await deleteExpense('e1');

        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('id', 'e1');
        expect(id).toBe('e1');
    });

    it('propagates a database error from addExpense', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));

        await expect(addExpense({ businessId: 'biz-1', category: 'divers', label: 'x', amount: 100 })).rejects.toThrow('boom');
    });
});
