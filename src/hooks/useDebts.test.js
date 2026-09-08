import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useDebts } from './useDebts';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchDebtsMock, addDebtMock, updateDebtMock, markDebtPaidMock, deleteDebtMock } = vi.hoisted(() => ({
    fetchDebtsMock: vi.fn(),
    addDebtMock: vi.fn(),
    updateDebtMock: vi.fn(),
    markDebtPaidMock: vi.fn(),
    deleteDebtMock: vi.fn(),
}));

vi.mock('../services/debtsService', () => ({
    fetchDebts: fetchDebtsMock,
    addDebt: addDebtMock,
    updateDebt: updateDebtMock,
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
const ACTOR = 'owner@test.com';

describe('useDebts', () => {
    beforeEach(() => {
        fetchDebtsMock.mockReset();
        addDebtMock.mockReset();
        updateDebtMock.mockReset();
        markDebtPaidMock.mockReset();
        deleteDebtMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchDebtsMock.mockResolvedValue([
            { id: 'd1', customer_name: 'Moussa', customer_phone: '77000', amount: 5000, note: 'Pièces moto', status: 'unpaid' },
            { id: 'd2', customer_name: 'Awa', amount: 2000, status: 'paid' },
        ]);
    });

    it('computes the total owed from unpaid debts only', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));

        await waitFor(() => expect(result.current.debts).toHaveLength(2));
        expect(result.current.unpaidDebts).toHaveLength(1);
        expect(result.current.totalOwed).toBe(5000);
    });

    it('rejects submitting a debt with no customer name', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.setFormData({ customerName: '', customerPhone: '', amount: '1000', note: '' }));
        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addDebtMock).not.toHaveBeenCalled();
    });

    it('submits a valid debt', async () => {
        addDebtMock.mockResolvedValueOnce();
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.setFormData({ customerName: 'Fatou', customerPhone: '', amount: '3000', note: '' }));
        await act(async () => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(addDebtMock).toHaveBeenCalledWith({
            businessId: 'biz-1', customerName: 'Fatou', customerPhone: '', amount: 3000, note: '',
        });
        await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    });

    it('queues a mark-paid action for confirmation without mutating immediately', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));

        expect(result.current.confirmAction).toEqual({ type: 'markPaid', item: { id: 'd1', customer_name: 'Moussa', amount: 5000 } });
        expect(markDebtPaidMock).not.toHaveBeenCalled();
    });

    it('marks a debt paid once the pending confirmation is confirmed', async () => {
        markDebtPaidMock.mockResolvedValueOnce('d1');
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));
        await act(async () => result.current.confirmPendingAction());

        expect(markDebtPaidMock.mock.calls[0]?.[0]).toBe('d1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });

    it('does not mark paid when the confirmation is cancelled', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleMarkPaid({ id: 'd1', customer_name: 'Moussa', amount: 5000 }));
        act(() => result.current.closeConfirmAction());

        expect(markDebtPaidMock).not.toHaveBeenCalled();
        expect(result.current.confirmAction).toBeNull();
    });

    it('deletes a debt once the pending confirmation is confirmed', async () => {
        deleteDebtMock.mockResolvedValueOnce('d1');
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        await waitFor(() => expect(result.current.debts).toHaveLength(2));

        act(() => result.current.handleDelete({ id: 'd1' }));
        await act(async () => result.current.confirmPendingAction());

        expect(deleteDebtMock.mock.calls[0]?.[0]).toBe('d1');
        await waitFor(() => expect(result.current.confirmAction).toBeNull());
    });

    it('pre-fills the form from the debt being edited', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        const debt = await waitFor(() => {
            expect(result.current.debts).toHaveLength(2);
            return result.current.debts.find((d) => d.id === 'd1');
        });

        act(() => result.current.openEditForm(debt));

        expect(result.current.editingDebt).toBe(debt);
        expect(result.current.formData).toEqual({
            customerName: 'Moussa', customerPhone: '77000', amount: '5000', note: 'Pièces moto',
        });
    });

    it('submits an edit through update_debt (with the actor for the audit log), not addDebt', async () => {
        updateDebtMock.mockResolvedValueOnce({ id: 'd1' });
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        const debt = await waitFor(() => {
            expect(result.current.debts).toHaveLength(2);
            return result.current.debts.find((d) => d.id === 'd1');
        });

        act(() => result.current.openEditForm(debt));
        act(() => result.current.setFormData({ customerName: 'Moussa Diop', customerPhone: '77000', amount: '6000', note: 'Pièces moto' }));
        await act(async () => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(updateDebtMock).toHaveBeenCalledWith({
            debtId: 'd1', userEmail: ACTOR, customerName: 'Moussa Diop', customerPhone: '77000', amount: 6000, note: 'Pièces moto',
        });
        expect(addDebtMock).not.toHaveBeenCalled();
        await waitFor(() => expect(result.current.isAddOpen).toBe(false));
    });

    it('resets edit mode when the form is closed', async () => {
        const { result } = renderHookWithQueryClient(() => useDebts(BUSINESS, ACTOR));
        const debt = await waitFor(() => {
            expect(result.current.debts).toHaveLength(2);
            return result.current.debts.find((d) => d.id === 'd1');
        });

        act(() => result.current.openEditForm(debt));
        act(() => result.current.closeForm());

        expect(result.current.editingDebt).toBeNull();
    });
});
