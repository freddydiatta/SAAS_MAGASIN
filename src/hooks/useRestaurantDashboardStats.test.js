import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useRestaurantDashboardStats } from './useRestaurantDashboardStats';
import { renderHookWithQueryClient } from '../test/testUtils';

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

const BUSINESS = { id: 'biz-1' };

const now = new Date();
const today = new Date(now); today.setHours(9, 0, 0, 0);
const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

const ORDERS = [
    { id: 'o1', table_number: '4', status: 'pending', total_amount: 5000, items: [{ quantity: 2 }], created_at: today.toISOString() },
    { id: 'o2', table_number: '2', status: 'served', total_amount: 3000, items: [{ quantity: 1 }, { quantity: 1 }], created_at: today.toISOString() },
    { id: 'o3', table_number: '1', status: 'paid', total_amount: 2000, items: [{ quantity: 3 }], created_at: today.toISOString() },
    { id: 'o4', table_number: 'À emporter', status: 'pending', total_amount: 1500, items: [{ quantity: 1 }], created_at: today.toISOString() },
    { id: 'o5', table_number: '9', status: 'paid', total_amount: 9000, items: [{ quantity: 5 }], created_at: yesterday.toISOString() },
];

describe('useRestaurantDashboardStats', () => {
    beforeEach(() => {
        fromMock.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ data: ORDERS, error: null }));
    });

    it('counts commandesEnCours as pending or served orders regardless of day', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantDashboardStats(BUSINESS));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        // o1 (pending), o2 (served), o4 (pending) => 3 active; o3/o5 (paid) excluded
        expect(result.current.commandesEnCours).toBe(3);
    });

    it('sums caisseDuJour from paid orders created today only', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // o3 is the only paid order from today (2000) — o5 is paid but from yesterday
        expect(result.current.caisseDuJour).toBe(2000);
    });

    it('sums platsServis from served+paid orders today by item quantities', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // o2 served (1+1=2) + o3 paid (3) = 5; o5 excluded (not today)
        expect(result.current.platsServis).toBe(5);
    });

    it('counts tablesOuvertes as distinct real table numbers among active orders, excluding takeaway', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // active: o1 (table 4), o2 (table 2), o4 (À emporter, excluded) => 2 tables
        expect(result.current.tablesOuvertes).toBe(2);
    });

    it('recentOrders returns at most the first 5 orders as-received', async () => {
        const { result } = renderHookWithQueryClient(() => useRestaurantDashboardStats(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.recentOrders).toHaveLength(5);
        expect(result.current.recentOrders.map(o => o.id)).toEqual(['o1', 'o2', 'o3', 'o4', 'o5']);
    });
});
