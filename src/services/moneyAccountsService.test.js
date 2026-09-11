import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fetchMoneyAccounts,
    addMoneyAccount,
    updateMoneyAccount,
    deleteMoneyAccount,
} from './moneyAccountsService';

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

describe('moneyAccountsService', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('fetchMoneyAccounts scopes to the business and keeps the creation order', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'a1', name: 'Caisse' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchMoneyAccounts('biz-1');

        expect(fromMock).toHaveBeenCalledWith('money_accounts');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at');
        expect(data).toEqual([{ id: 'a1', name: 'Caisse' }]);
    });

    it('addMoneyAccount stores the opening balance', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addMoneyAccount({ businessId: 'biz-1', name: 'Wave', kind: 'mobile_money', openingBalance: 39000 });

        expect(builder.insert).toHaveBeenCalledWith([{
            business_id: 'biz-1', name: 'Wave', kind: 'mobile_money', opening_balance: 39000,
        }]);
    });

    it('updateMoneyAccount redates the starting point, so past sales are not counted twice', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await updateMoneyAccount({ id: 'a1', name: 'Wave', kind: 'mobile_money', openingBalance: 41000 });

        expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Wave', kind: 'mobile_money', opening_balance: 41000, opening_at: expect.any(String),
        }));
        expect(builder.eq).toHaveBeenCalledWith('id', 'a1');
    });

    it('deleteMoneyAccount removes the row by id', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        const id = await deleteMoneyAccount('a1');

        expect(builder.delete).toHaveBeenCalled();
        expect(builder.eq).toHaveBeenCalledWith('id', 'a1');
        expect(id).toBe('a1');
    });

    it('propagates a database error', async () => {
        fromMock.mockImplementation(() => createQueryBuilder({ data: null, error: new Error('boom') }));

        await expect(fetchMoneyAccounts('biz-1')).rejects.toThrow('boom');
    });
});
