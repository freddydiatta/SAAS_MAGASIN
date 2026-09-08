import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDebts, addDebt, updateDebt, markDebtPaid, deleteDebt } from './debtsService';

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

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock, rpc: rpcMock },
}));

describe('debtsService', () => {
    beforeEach(() => {
        fromMock.mockReset();
        rpcMock.mockReset();
    });

    it('fetchDebts joins the linked receipt (for the item detail) and orders by most recent first', async () => {
        const builder = createQueryBuilder({ data: [{ id: 'd1' }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchDebts('biz-1');

        expect(fromMock).toHaveBeenCalledWith('debts');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(data).toEqual([{ id: 'd1' }]);
    });

    it('addDebt defaults blank optional fields and a missing receiptId to null', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addDebt({ businessId: 'biz-1', customerName: 'Moussa Diop', customerPhone: '', amount: 5000, note: '' });

        expect(builder.insert).toHaveBeenCalledWith([{
            business_id: 'biz-1', customer_name: 'Moussa Diop', customer_phone: null, amount: 5000, note: null, receipt_id: null,
        }]);
    });

    it('addDebt stores the linked receipt id when a credit sale created it', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addDebt({ businessId: 'biz-1', customerName: 'Moussa Diop', amount: 5000, receiptId: 'r1' });

        expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({ receipt_id: 'r1' })]);
    });

    it('updateDebt calls the audited RPC with snake_case params, defaulting blanks to null', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'd1' }, error: null });

        await updateDebt({
            debtId: 'd1', userEmail: 'owner@test.com', customerName: 'Moussa Diop', customerPhone: '', amount: 6000, note: '',
        });

        expect(rpcMock).toHaveBeenCalledWith('update_debt', {
            p_debt_id: 'd1',
            p_user_email: 'owner@test.com',
            p_customer_name: 'Moussa Diop',
            p_customer_phone: null,
            p_amount: 6000,
            p_note: null,
        });
    });

    it('propagates a database error from updateDebt', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Dette introuvable') });

        await expect(updateDebt({ debtId: 'd1', userEmail: 'owner@test.com', customerName: 'x', amount: 100 }))
            .rejects.toThrow('Dette introuvable');
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
