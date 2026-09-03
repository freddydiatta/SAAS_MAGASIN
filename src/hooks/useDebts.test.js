import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useDebts } from './useDebts';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchDebtsMock, addDebtMock, markDebtPaidMock, deleteDebtMock } = vi.hoisted(() => ({
    fetchDebtsMock: vi.fn(),
    addDebtMock: vi.fn(),
    markDebtPaidMock: vi.fn(),
    deleteDebtMock: vi.fn(),
}));

vi.mock('../services/debtsService', () => ({
    fetchDebts: fetchDebtsMock,
    addDebt: addDebtMock,
    markDebtPaid: markDebtPaidMock,
    deleteDebt: deleteDebtMock,
}));

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const BUSINESS = { id: 'biz-1' };

describe('useDebts', () => {
    beforeEach(() => {
        fetchDebtsMock.mockReset();
        addDebtMock.mockReset();
        markDebtPaidMock.mockReset();
        deleteDebtMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchDebtsMock.mockResolvedValue([
            { id: 'd1', customer_name: 'Moussa', amount: 5000, status: 'unpaid' },
            { id: 'd2', customer_name: 'Awa', amount: 2000, status: 'paid' },
        ]);
    });

    it('computes the total owed from unpaid debts only', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));

        await waitFor(() => expect(result.current.debts).toHaveLength(2));
        expect(result.current.unpaidDebts).toHaveLength(1);
        expect(result.current.totalOwed).toBe(5000);
    });

    it('rejects submitting a debt with no customer name', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.setFormData({ customerName: '', customerPhone: '', amount: '1000', note: '' }));
        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addDebtMock).not.toHaveBeenCalled();
    });

    it('submits a valid debt', async () => {
        addDebtMock.mockResolvedValueOnce();
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.setFormData({ customerName: 'Fatou', customerPhone: '', amount: '3000', note: '' }));
        await act(async () => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(addDebtMock).toHaveBeenCalledWith({
            businessId: 'biz-1', customerName: 'Fatou', customerPhone: '', amount: 3000, note: '',
        });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('queues a mark-paid action for confirmation without mutating immediately', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));

        expect(result.current.confirmAction).toEqual({ type: 'markPaid', item: { id: 'd1', customer_name: 'Moussa', amount: 5000 } });
        expect(markDebtPaidMock).not.toHaveBeenCalled();
    });

    it('marks a debt paid once the pending confirmation is confirmed', async () => {
        markDebtPaidMock.mockResolvedValueOnce('d1');
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));
        await act(async () => result.current.confirmPendingAction());

        expect(markDebtPaidMock.mock.calls[0]?.[0]).toBe('d1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });

    it('does not mark paid when the confirmation is cancelled', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));
        act(() => result.current.closeConfirmAction());

        expect(markDebtPaidMock).not.toHaveBeenCalled();
        expect(result.current.confirmAction).toBeNull();
    });

    it('deletes a debt once the pending confirmation is confirmed', async () => {
        deleteDebtMock.mockResolvedValueOnce('d1');
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleDelete({ id: 'd1' }));
        await act(async () => result.current.confirmPendingAction());

        expect(deleteDebtMock.mock.calls[0]?.[0]).toBe('d1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });
});
