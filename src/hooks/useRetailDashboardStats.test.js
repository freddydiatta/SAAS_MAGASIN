import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useRetailDashboardStats } from './useRetailDashboardStats';
import { renderHookWithQueryClient } from '../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'u1', email: 'owner@test.com' } }),
}));

const BUSINESS = { id: 'biz-1' };
const PRODUCTS = [
    { id: 'p1', name: 'Casque Moto', stock_quantity: 1 }, // <= 2, counts as low stock
    { id: 'p2', name: 'Pneu', stock_quantity: 10 },
];

const now = new Date();
const today9am = new Date(now); today9am.setHours(9, 0, 0, 0);
const yesterday9am = new Date(today9am); yesterday9am.setDate(yesterday9am.getDate() - 1);

const SALES = [
    { id: 's1', quantity: 2, total_price: 2000, created_at: today9am.toISOString(), products: { name: 'Casque Moto', type: 'moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
    { id: 's2', quantity: 1, total_price: 1000, created_at: today9am.toISOString(), products: { name: 'Pneu', type: 'moto' }, receipts: { status: 'completed', payment_method: 'mobile_money' } },
    { id: 's3', quantity: 1, total_price: 500, created_at: yesterday9am.toISOString(), products: { name: 'Casque Moto', type: 'moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
];

const SALES_WITH_CREDIT = [
    ...SALES,
    { id: 's4', quantity: 1, total_price: 4000, created_at: today9am.toISOString(), products: { name: 'Casque Moto', type: 'moto' }, receipts: { status: 'completed', payment_method: 'credit' } },
];

const EXPENSES = [
    { id: 'e1', category: 'transport', amount: 500, created_at: today9am.toISOString() },
    { id: 'e2', category: 'divers', amount: 300, created_at: yesterday9am.toISOString() }, // not today -> excluded
];

describe('useRetailDashboardStats', () => {
    beforeEach(() => {
        fromMock.mockReset();
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'expenses') return createQueryBuilder({ data: EXPENSES, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
    });

    it('computes today vs yesterday totals, percent change, average basket and stock alerts', async () => {
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS));

        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // today: 2000 (cash) + 1000 (mobile) = 3000 ; yesterday: 500
        expect(result.current.caisseDuJour).toBe(3000);
        expect(result.current.caisseDuJourCash).toBe(2000);
        expect(result.current.caisseDuJourMobile).toBe(1000);
        expect(result.current.percentChange).toBe(Math.round(((3000 - 500) / 500) * 100));
        expect(result.current.transactions).toBe(2);
        expect(result.current.diffTransactions).toBe(1); // 2 today - 1 yesterday
        expect(result.current.panierMoyen).toBe(1500); // 3000 / 2
        expect(result.current.alertesStock).toBe(1);
        expect(result.current.lowStockProducts).toEqual([{ id: 'p1', name: 'Casque Moto', stock_quantity: 1 }]);
        // only e1 (transport, 500) falls on today; e2 was yesterday
        expect(result.current.depensesDuJour).toBe(500);
        expect(result.current.beneficeDuJour).toBe(3000 - 500);
    });

    it('produces a 7-day chart series and top products ranked by quantity sold', async () => {
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.chartData).toHaveLength(7);
        expect(result.current.topProducts[0]).toMatchObject({ name: 'Casque Moto', quantity: 3, revenue: 2500 });
    });

    it('excludes credit sales from caisse du jour and the average basket, but still counts them as a transaction', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'expenses') return createQueryBuilder({ data: EXPENSES, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES_WITH_CREDIT, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // Same collected total as before (3000) — the 4000 credit sale is not
        // money actually in hand yet.
        expect(result.current.caisseDuJour).toBe(3000);
        expect(result.current.caisseDuJourCredit).toBe(4000);
        expect(result.current.beneficeDuJour).toBe(3000 - 500);
        // panier moyen only averages the two collected sales, not the credit one
        expect(result.current.panierMoyen).toBe(1500);
        // but the credit sale still happened — it counts as a transaction
        expect(result.current.transactions).toBe(3);
    });

    it('excludes credit sales from the 7-day chart total and per-product revenue, but keeps their quantity', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'expenses') return createQueryBuilder({ data: EXPENSES, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES_WITH_CREDIT, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        const todayEntry = result.current.chartData[result.current.chartData.length - 1];
        expect(todayEntry.total).toBe(3000);

        const casque = result.current.topProducts.find((p) => p.name === 'Casque Moto');
        // quantity: 2 (cash) + 1 (yesterday cash) + 1 (credit) = 4 units actually sold
        expect(casque.quantity).toBe(4);
        // revenue: only the cash sales (2000 + 500), not the 4000 credit sale
        expect(casque.revenue).toBe(2500);
    });

    it('counts a debt repaid today as cash collected, without treating it as a basket', async () => {
        const DEBTS = [
            { id: 'd1', customer_name: 'Moussa', amount: 4000, status: 'paid', paid_at: today9am.toISOString() },
            { id: 'd2', customer_name: 'Awa', amount: 1000, status: 'unpaid' },
        ];
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'expenses') return createQueryBuilder({ data: EXPENSES, error: null });
            if (table === 'debts') return createQueryBuilder({ data: DEBTS, error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // 3000 in sales + the 4000 debt repaid today
        expect(result.current.caisseDuJour).toBe(7000);
        expect(result.current.caisseDuJourRembourse).toBe(4000);
        // still only 2 actual sales today -> unaffected average basket
        expect(result.current.panierMoyen).toBe(1500);
        expect(result.current.beneficeDuJour).toBe(7000 - 500);
    });

    it('returns 0% change (not a divide-by-zero) when there were no sales yesterday and none today', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            return createQueryBuilder({ data: [], error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.percentChange).toBe(0);
        expect(result.current.panierMoyen).toBe(0);
    });
});
