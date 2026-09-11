import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useMoneyAccounts } from './useMoneyAccounts';
import { renderHookWithQueryClient } from '../test/testUtils';

const { fetchMock, addMock, updateMock, deleteMock } = vi.hoisted(() => ({
    fetchMock: vi.fn(),
    addMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
}));

vi.mock('../services/moneyAccountsService', () => ({
    fetchMoneyAccounts: fetchMock,
    addMoneyAccount: addMock,
    updateMoneyAccount: updateMock,
    deleteMoneyAccount: deleteMock,
}));

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const BUSINESS = { id: 'biz-1' };

const ACCOUNTS = [
    { id: 'a1', name: 'Caisse', balance: 16500, updated_at: '2026-09-12T08:00:00.000Z' },
    { id: 'a2', name: 'Wave', balance: 39000, updated_at: '2026-09-12T08:00:00.000Z' },
];

describe('useMoneyAccounts', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        addMock.mockReset();
        updateMock.mockReset();
        deleteMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchMock.mockResolvedValue(ACCOUNTS);
    });

    it('totals every account, which is the whole point of listing them', async () => {
        const { result } = renderHookWithQueryClient(() => useMoneyAccounts(BUSINESS));
        await waitFor(() => expect(result.current.accounts).toHaveLength(2));

        expect(result.current.totalBalance).toBe(55500);
    });

    it('rejects a blank name without hitting the network', async () => {
        const { result } = renderHookWithQueryClient(() => useMoneyAccounts(BUSINESS));
        await waitFor(() => expect(result.current.accounts).toHaveLength(2));

        act(() => result.current.setFormData({ name: '', balance: '1000' }));
        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addMock).not.toHaveBeenCalled();
    });

    it('rejects a negative balance — a wallet cannot hold less than nothing', async () => {
        const { result } = renderHookWithQueryClient(() => useMoneyAccounts(BUSINESS));
        await waitFor(() => expect(result.current.accounts).toHaveLength(2));

        act(() => result.current.setFormData({ name: 'Wave', balance: '-500' }));
        act(() => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(toastErrorMock).toHaveBeenCalled();
        expect(addMock).not.toHaveBeenCalled();
    });

    it('adds a new account', async () => {
        addMock.mockResolvedValueOnce();
        const { result } = renderHookWithQueryClient(() => useMoneyAccounts(BUSINESS));
        await waitFor(() => expect(result.current.accounts).toHaveLength(2));

        act(() => result.current.openAddForm());
        act(() => result.current.setFormData({ name: 'Orange Money', balance: '12000' }));
        await act(async () => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(addMock).toHaveBeenCalledWith({ businessId: 'biz-1', name: 'Orange Money', balance: 12000 });
        await waitFor(() => expect(result.current.isFormOpen).toBe(false));
    });

    it('pre-fills the form with the account being corrected and updates it', async () => {
        updateMock.mockResolvedValueOnce();
        const { result } = renderHookWithQueryClient(() => useMoneyAccounts(BUSINESS));
        await waitFor(() => expect(result.current.accounts).toHaveLength(2));

        act(() => result.current.openEditForm(ACCOUNTS[1]));

        expect(result.current.formData).toEqual({ name: 'Wave', balance: '39000' });

        act(() => result.current.setFormData({ name: 'Wave', balance: '41000' }));
        await act(async () => result.current.handleSubmit({ preventDefault: () => {} }));

        expect(updateMock).toHaveBeenCalledWith({ id: 'a2', name: 'Wave', balance: 41000 });
        expect(addMock).not.toHaveBeenCalled();
        await waitFor(() => expect(result.current.editingAccount).toBeNull());
    });

    it('asks for confirmation before deleting an account', async () => {
        const { result } = renderHookWithQueryClient(() => useMoneyAccounts(BUSINESS));
        await waitFor(() => expect(result.current.accounts).toHaveLength(2));

        act(() => result.current.handleDelete(ACCOUNTS[0]));

        expect(result.current.accountToDelete).toEqual(ACCOUNTS[0]);
        expect(deleteMock).not.toHaveBeenCalled();

        await act(async () => result.current.confirmDelete());

        expect(deleteMock.mock.calls[0]?.[0]).toBe('a1');
    });
});
