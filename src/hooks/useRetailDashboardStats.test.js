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
