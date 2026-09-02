import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useVillaDashboardStats } from './useVillaDashboardStats';
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
const VILLAS = [{ id: 'v1', name: 'Villa Saly', price_per_night: 50000 }, { id: 'v2', name: 'Villa Popenguine', price_per_night: 40000 }];

// Ancrées sur "aujourd'hui" (pas un jour fixe du mois) pour que le test
// reste correct quel que soit le jour du mois où il tourne réellement —
// un booking "du mois en cours" doit rester actif (end_date >= today) peu
// importe où on en est dans le mois.
const today = new Date();
const inCurrentMonth = new Date(today);
const inCurrentMonthEnd = new Date(today); inCurrentMonthEnd.setDate(inCurrentMonthEnd.getDate() + 3);
const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 10);
const lastMonthEnd = new Date(lastMonth); lastMonthEnd.setDate(lastMonthEnd.getDate() + 2);
const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
const nextMonthEnd = new Date(nextMonth); nextMonthEnd.setDate(nextMonthEnd.getDate() + 2);

const BOOKINGS = [
    { id: 'b1', customer_name: 'Client A', status: 'confirmé', start_date: inCurrentMonth.toISOString(), end_date: inCurrentMonthEnd.toISOString(), total_price: 150000, villas: { name: 'Villa Saly' } },
    { id: 'b2', customer_name: 'Client B (annulé)', status: 'annulé', start_date: inCurrentMonth.toISOString(), end_date: inCurrentMonthEnd.toISOString(), total_price: 999999, villas: { name: 'Villa Saly' } },
    { id: 'b3', customer_name: 'Client C (mois dernier)', status: 'confirmé', start_date: lastMonth.toISOString(), end_date: lastMonthEnd.toISOString(), total_price: 80000, villas: { name: 'Villa Popenguine' } },
    { id: 'b4', customer_name: 'Client D (à venir)', status: 'provisoire', start_date: nextMonth.toISOString(), end_date: nextMonthEnd.toISOString(), total_price: 120000, villas: { name: 'Villa Popenguine' } },
];

describe('useVillaDashboardStats', () => {
    beforeEach(() => {
        fromMock.mockReset();
        fromMock.mockImplementation((table) => {
            if (table === 'villas') return createQueryBuilder({ data: VILLAS, error: null });
            return createQueryBuilder({ data: BOOKINGS, error: null });
        });
    });

    it('sums monthly revenue only from non-cancelled bookings starting this month', async () => {
        const { result } = renderHookWithQueryClient(() => useVillaDashboardStats(BUSINESS));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        // b1 (150000) counts; b2 is cancelled despite starting this month;
        // b3 started last month; b4 starts next month.
        expect(result.current.monthlyRevenue).toBe(150000);
    });

    it('counts active bookings as non-cancelled with an end date not yet passed', async () => {
        const { result } = renderHookWithQueryClient(() => useVillaDashboardStats(BUSINESS));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        // b1 (ends this month, still upcoming/ongoing) and b4 (next month) are active;
        // b2 is cancelled, b3 already ended last month.
        expect(result.current.activeBookingsCount).toBe(2);
    });

    it('lists upcoming bookings sorted by start date, excluding cancelled and past ones', async () => {
        const { result } = renderHookWithQueryClient(() => useVillaDashboardStats(BUSINESS));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.upcomingBookings.map((b) => b.id)).toEqual(['b1', 'b4']);
    });

    it('reports the total number of managed villas', async () => {
        const { result } = renderHookWithQueryClient(() => useVillaDashboardStats(BUSINESS));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.villasCount).toBe(2);
    });
});
