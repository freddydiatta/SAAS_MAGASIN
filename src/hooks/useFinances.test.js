import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useFinances } from './useFinances';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchAllSalesMock, fetchExpensesMock, fetchDebtsMock, fetchPurchaseOrdersMock } = vi.hoisted(() => ({
    fetchAllSalesMock: vi.fn(),
    fetchExpensesMock: vi.fn(),
    fetchDebtsMock: vi.fn(),
    fetchPurchaseOrdersMock: vi.fn(),
}));

vi.mock('../services/financesService', () => ({
    fetchAllSales: fetchAllSalesMock,
}));

vi.mock('../services/expensesService', () => ({
    fetchExpenses: fetchExpensesMock,
}));

vi.mock('../services/debtsService', () => ({
    fetchDebts: fetchDebtsMock,
}));

vi.mock('../services/purchaseOrdersService', () => ({
    fetchPurchaseOrders: fetchPurchaseOrdersMock,
}));

const BUSINESS = { id: 'biz-1' };

const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10, 9, 0, 0);
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10, 9, 0, 0);

const SALES = [
    { id: 's1', total_price: 3000, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
    { id: 's2', total_price: 2000, created_at: thisMonth.toISOString(), products: { name: 'Pneu' }, receipts: { status: 'completed', payment_method: 'mobile_money' } },
    { id: 's3', total_price: 5000, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'credit' } },
    { id: 's4', total_price: 1000, created_at: lastMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
];

const DEBTS = [
    { id: 'd1', customer_name: 'Moussa', amount: 1500, status: 'paid', paid_at: thisMonth.toISOString() },
    { id: 'd2', customer_name: 'Awa', amount: 800, status: 'unpaid' },
];

const EXPENSES = [
    { id: 'e1', category: 'transport', amount: 700, created_at: thisMonth.toISOString() },
    { id: 'e2', category: 'divers', amount: 400, created_at: lastMonth.toISOString() },
];

describe('useFinances', () => {
    beforeEach(() => {
        fetchAllSalesMock.mockReset();
        fetchExpensesMock.mockReset();
        fetchDebtsMock.mockReset();
        fetchPurchaseOrdersMock.mockReset();
        fetchAllSalesMock.mockResolvedValue(SALES);
        fetchExpensesMock.mockResolvedValue(EXPENSES);
        fetchDebtsMock.mockResolvedValue(DEBTS);
        fetchPurchaseOrdersMock.mockResolvedValue([]);
    });

    it('computes total revenue as collected sales plus repaid debts, excluding credit sales and unpaid debts', async () => {
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // (3000 cash + 2000 mobile + 1000 last month) + 1500 repaid debt = 7500
        // the 5000 credit sale and the 800 unpaid debt are excluded
        expect(result.current.totalRevenue).toBe(7500);
        expect(result.current.totalExpenses).toBe(1100);
        expect(result.current.netProfit).toBe(6400);
        expect(result.current.pendingDebtsTotal).toBe(800);
    });

    it('computes this-month figures and the month-over-month percent change', async () => {
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // this month: 3000 + 2000 (sales) + 1500 (repaid debt) = 6500
        expect(result.current.revenueThisMonth).toBe(6500);
        expect(result.current.expensesThisMonth).toBe(700);
        expect(result.current.profitThisMonth).toBe(5800);
        // last month revenue was 1000 -> (6500-1000)/1000 * 100 = 550%
        expect(result.current.percentChangeMonth).toBe(550);
    });

    it('produces a 6-month trend with the current month last', async () => {
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.monthlyTrend).toHaveLength(6);
        const currentMonthEntry = result.current.monthlyTrend[5];
        expect(currentMonthEntry).toMatchObject({ revenue: 6500, expenses: 700, profit: 5800 });
    });

    it('returns 0% change (not a divide-by-zero) with no revenue at all', async () => {
        fetchAllSalesMock.mockResolvedValue([]);
        fetchDebtsMock.mockResolvedValue([]);
        fetchExpensesMock.mockResolvedValue([]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.percentChangeMonth).toBe(0);
        expect(result.current.totalRevenue).toBe(0);
    });

    it('counts a received purchase order as an expense, but not a pending or cancelled one', async () => {
        fetchPurchaseOrdersMock.mockResolvedValue([
            { id: 'po1', status: 'received', total_amount: 2000, received_at: thisMonth.toISOString(), created_at: thisMonth.toISOString() },
            { id: 'po2', status: 'pending', total_amount: 9000, created_at: thisMonth.toISOString() },
            { id: 'po3', status: 'cancelled', total_amount: 5000, created_at: thisMonth.toISOString() },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // 1100 (expenses) + 2000 (the received order only)
        expect(result.current.totalExpenses).toBe(3100);
        expect(result.current.expensesThisMonth).toBe(700 + 2000);
        expect(result.current.netProfit).toBe(7500 - 3100);
    });
});
