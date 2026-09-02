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

    it('marks a debt paid only after confirmation', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        markDebtPaidMock.mockResolvedValueOnce('d1');
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));

        await waitFor(() => expect(markDebtPaidMock.mock.calls[0]?.[0]).toBe('d1'));
        confirmSpy.mockRestore();
    });

    it('does not mark paid when the confirmation is cancelled', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));

        expect(markDebtPaidMock).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('deletes a debt after confirmation', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        deleteDebtMock.mockResolvedValueOnce('d1');
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleDelete({ id: 'd1' }));

        await waitFor(() => expect(deleteDebtMock.mock.calls[0]?.[0]).toBe('d1'));
        confirmSpy.mockRestore();
    });
});
