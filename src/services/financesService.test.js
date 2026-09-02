import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllSales } from './financesService';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

describe('financesService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('fetchAllSales scopes to the business, completed receipts only, oldest first', async () => {
        const builder = createQueryBuilder({ data: [{ id: 's1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchAllSales('biz-1');

        expect(fromMock).toHaveBeenCalledWith('sales');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.eq).toHaveBeenCalledWith('receipts.status', 'completed');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
        expect(data).toEqual([{ id: 's1' }]);
    });

    it('propagates a database error', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));

        await expect(fetchAllSales('biz-1')).rejects.toThrow('boom');
    });
});
