import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useExpenses } from './useExpenses';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchExpensesMock, addExpenseMock, deleteExpenseMock } = vi.hoisted(() => ({
    fetchExpensesMock: vi.fn(),
    addExpenseMock: vi.fn(),
    deleteExpenseMock: vi.fn(),
}));

vi.mock('../services/expensesService', () => ({
    fetchExpenses: fetchExpensesMock,
    addExpense: addExpenseMock,
    deleteExpense: deleteExpenseMock,
    EXPENSE_CATEGORIES: { transport: 'Transport', divers: 'Divers' },
}));

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const BUSINESS = { id: 'biz-1' };

const now = new Date();
const today9am = new Date(now); today9am.setHours(9, 0, 0, 0);
const yesterday9am = new Date(today9am); yesterday9am.setDate(yesterday9am.getDate() - 1);

describe('useExpenses', () => {
    beforeEach(() => {
        fetchExpensesMock.mockReset();
        addExpenseMock.mockReset();
        deleteExpenseMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchExpensesMock.mockResolvedValue([
            { id: 'e1', category: 'transport', amount: 500, created_at: today9am.toISOString() },
            { id: 'e2', category: 'divers', label: 'Réparation', amount: 300, created_at: yesterday9am.toISOString() },
        ]);
    });

    it('computes total and today-only totals from the fetched expenses', async () => {
        const { result } = renderHookWithQueryClient(() => useExpenses(BUSINESS, 'owner@test.com'));

        await waitFor(() => expect(result.current.expenses).toHaveLength(2));
        expect(result.current.totalExpenses).toBe(800);
        expect(result.current.totalExpensesToday).toBe(500);
    });

    it('rejects submitting a "divers" expense with no label', async () => {
        const { result } = renderHookWithQueryClient(() => useExpenses(BUSINESS, 'owner@test.com'));
        await waitFor(() => expect(result.current.expenses).toHaveLength(2));

        act(() => result.current.setFormData({ category: 'divers', label: '', amount: '1000' }));
        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addExpenseMock).not.toHaveBeenCalled();
    });

    it('submits a valid expense, attributing it to the current actor', async () => {
        addExpenseMock.mockResolvedValueOnce();
        const { result } = renderHookWithQueryClient(() => useExpenses(BUSINESS, 'owner@test.com'));
        await waitFor(() => expect(result.current.expenses).toHaveLength(2));

        act(() => result.current.setFormData({ category: 'transport', label: '', amount: '750' }));
        await act(async () => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(addExpenseMock).toHaveBeenCalledWith({
            businessId: 'biz-1', createdBy: 'owner@test.com', category: 'transport', label: '', amount: 750,
        });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('deletes an expense after confirmation', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        deleteExpenseMock.mockResolvedValueOnce('e1');
        const { result } = renderHookWithQueryClient(() => useExpenses(BUSINESS, 'owner@test.com'));
        await waitFor(() => expect(result.current.expenses).toHaveLength(2));

        act(() => result.current.handleDelete({ id: 'e1' }));

        // React Query v5 calls mutationFn with a second (context) argument;
        // only the id we passed in actually matters here.
        await waitFor(() => expect(deleteExpenseMock.mock.calls[0]?.[0]).toBe('e1'));
        confirmSpy.mockRestore();
    });

    it('does not delete when the confirmation is cancelled', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHookWithQueryClient(() => useExpenses(BUSINESS, 'owner@test.com'));
        await waitFor(() => expect(result.current.expenses).toHaveLength(2));

        act(() => result.current.handleDelete({ id: 'e1' }));

        expect(deleteExpenseMock).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
