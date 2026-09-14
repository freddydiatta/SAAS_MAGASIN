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
        const builder = createQueryBuilder({ data: [{ id: 'd1', amount: 5000 }], error: null });
        fromMock.mockImplementation(() => builder);

        const data = await fetchDebts('biz-1');

        expect(fromMock).toHaveBeenCalledWith('debts');
        expect(builder.eq).toHaveBeenCalledWith('business_id', 'biz-1');
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(data).toEqual([expect.objectContaining({ id: 'd1' })]);
    });

    it('fetchDebts dit ce qui a déjà été versé et ce qui reste dû', async () => {
        // une dette se rembourse par tranches : son montant seul ne dit plus
        // où en est le client
        const builder = createQueryBuilder({
            data: [{
                id: 'd1', amount: 10000, status: 'unpaid',
                payments: [
                    { id: 'p1', amount: 3000, payment_method: 'cash', paid_at: '2026-09-10T10:00:00Z' },
                    { id: 'p2', amount: 2000, payment_method: 'mobile_money', paid_at: '2026-09-12T10:00:00Z' },
                ],
            }],
            error: null,
        });
        fromMock.mockImplementation(() => builder);

        const [debt] = await fetchDebts('biz-1');

        expect(debt.amountPaid).toBe(5000);
        expect(debt.remaining).toBe(5000);
        expect(debt.isSettled).toBe(false);
    });

    it('fetchDebts compte une dette soldée comme telle', async () => {
        const builder = createQueryBuilder({
            data: [{ id: 'd1', amount: 4000, payments: [{ id: 'p1', amount: 4000 }] }],
            error: null,
        });
        fromMock.mockImplementation(() => builder);

        const [debt] = await fetchDebts('biz-1');

        expect(debt.remaining).toBe(0);
        expect(debt.isSettled).toBe(true);
    });

    it('addDebt defaults blank optional fields and a missing receiptId to null', async () => {
        const builder = createQueryBuilder({ data: null, error: null });
        fromMock.mockImplementation(() => builder);

        await addDebt({ businessId: 'biz-1', customerName: 'Moussa Diop', customerPhone: '', amount: 5000, note: '' });

        // id et created_at tirés côté client, pour que la ligne soit rejouable
        // telle quelle si elle a été saisie hors-ligne.
        expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({
            business_id: 'biz-1', customer_name: 'Moussa Diop', customer_phone: null, amount: 5000, note: null, receipt_id: null,
        })]);
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
            debtId: 'd1', customerName: 'Moussa Diop', customerPhone: '', amount: 6000, note: '',
        });

        expect(rpcMock).toHaveBeenCalledWith('update_debt', {
            p_debt_id: 'd1',
            p_customer_name: 'Moussa Diop',
            p_customer_phone: null,
            p_amount: 6000,
            p_note: null,
        });
    });

    it('propagates a database error from updateDebt', async () => {
        rpcMock.mockResolvedValue({ data: null, error: new Error('Dette introuvable') });

        await expect(updateDebt({ debtId: 'd1', customerName: 'x', amount: 100 }))
            .rejects.toThrow('Dette introuvable');
    });

    it('markDebtPaid enregistre un versement daté, pas un simple changement de statut', async () => {
        // c'est le versement qui entre en caisse, à sa propre date : le statut
        // de la dette se déduit ensuite de la somme des versements, côté base.
        rpcMock.mockResolvedValue({ data: { id: 'd1', status: 'paid' }, error: null });

        await markDebtPaid({ id: 'd1', paymentMethod: 'cash', remaining: 5000 });

        expect(rpcMock).toHaveBeenCalledWith('record_debt_payment', expect.objectContaining({
            p_debt_id: 'd1',
            // champ vide = le client solde tout ce qu'il reste
            p_amount: 5000,
            p_payment_method: 'cash',
        }));
    });

    it('markDebtPaid ne verse que le montant de l\'avance quand il est précisé', async () => {
        rpcMock.mockResolvedValue({ data: { id: 'd1', status: 'unpaid' }, error: null });

        await markDebtPaid({ id: 'd1', paymentMethod: 'cash', amount: 5000, remaining: 10000 });

        expect(rpcMock).toHaveBeenCalledWith('record_debt_payment', expect.objectContaining({ p_amount: 5000 }));
    });

    it('markDebtPaid refuse un versement supérieur au reste dû', async () => {
        // sinon la caisse encaisserait plus que ce que le client devait
        await expect(markDebtPaid({ id: 'd1', paymentMethod: 'cash', amount: 12000, remaining: 10000 }))
            .rejects.toThrow(/ne doit plus que/);
        expect(rpcMock).not.toHaveBeenCalled();
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
