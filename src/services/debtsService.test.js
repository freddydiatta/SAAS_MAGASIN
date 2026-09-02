import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDebts, addDebt, markDebtPaid, deleteDebt } from './debtsService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

describe('debtsService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('fetchDebts orders by most recent first', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'd1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchDebts('biz-1');

        expect(fromMock).toHaveBeenCalledWith('debts');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(data).toEqual([{ id: 'd1' }]);
    });

    it('addDebt defaults blank optional fields to null', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addDebt({ businessId: 'biz-1', customerName: 'Moussa Diop', customerPhone: '', amount: 5000, note: '' });

        expect(builder.insert).toHaveBeenCalledWith([{
            business_id: 'biz-1', customer_name: 'Moussa Diop', customer_phone: null, amount: 5000, note: null,
        }]);
    });

    it('markDebtPaid sets the status and a paid timestamp', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        const id = await markDebtPaid('d1');

        expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }));
        expect(builder.eq).toHaveBeenCalledWith('id', 'd1');
        expect(id).toBe('d1');
    });

    it('deleteDebt removes the row by id', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        const id = await deleteDebt('d1');

        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('id', 'd1');
        expect(id).toBe('d1');
    });

    it('propagates a database error from addDebt', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));

        await expect(addDebt({ businessId: 'biz-1', customerName: 'x', amount: 100 })).rejects.toThrow('boom');
    });
});
