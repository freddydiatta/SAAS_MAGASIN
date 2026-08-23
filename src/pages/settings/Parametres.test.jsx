import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parametres } from './Parametres';
import { renderWithQueryClient } from '../../test/testUtils';

const { useAuthMock, useBusinessMock, invokeMock, listCashiersMock, updateUserMock, refreshSessionMock } = vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useBusinessMock: vi.fn(),
    invokeMock: vi.fn(),
    listCashiersMock: vi.fn(),
    updateUserMock: vi.fn(),
    refreshSessionMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('../../contexts/BusinessContext', () => ({ useBusiness: useBusinessMock }));
vi.mock('../../lib/supabase', () => ({
    supabase: { functions: { invoke: invokeMock }, auth: { updateUser: updateUserMock } },
}));
vi.mock('../../services/cashiersService', () => ({
    listCashiers: listCashiersMock,
    createCashier: vi.fn(),
    setCashierActive: vi.fn(),
}));

const BUSINESS = { id: 'biz-1' };

describe('Parametres — subscription section', () => {
    beforeEach(() => {
        useAuthMock.mockReset();
        useBusinessMock.mockReset();
        invokeMock.mockReset();
        listCashiersMock.mockReset();
        updateUserMock.mockReset();
        refreshSessionMock.mockReset();
        listCashiersMock.mockResolvedValue([]);
        useBusinessMock.mockReturnValue({ selectedBusiness: BUSINESS });
    });

    it('shows the Essentiel plan and an upgrade button that requests the Business plan', async () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'essentiel' } } });
        invokeMock.mockResolvedValue({ data: { invoice_url: 'https://paydunya.com/fake-invoice' }, error: null });
        const user = userEvent.setup();
        renderWithQueryClient(<Parametres />);

        expect(await screen.findByText(/Abonnement — Pack Essentiel/)).toBeInTheDocument();
        const upgradeButton = screen.getByRole('button', { name: /passer au pack business/i });

        await user.click(upgradeButton);

        await waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith('paydunya-checkout', {
                body: { business_id: 'biz-1', target_plan: 'business' },
            });
        });
    });

    it('shows the Business plan with no upgrade button when already on it', async () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'business' } } });
        renderWithQueryClient(<Parametres />);

        expect(await screen.findByText(/Abonnement — Pack Business/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /passer au pack business/i })).not.toBeInTheDocument();
        expect(screen.getByText(/magasins illimités/i)).toBeInTheDocument();
    });

    it('downgrades to Essentiel after confirmation', async () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'business' } }, refreshSession: refreshSessionMock });
        updateUserMock.mockResolvedValue({ error: null });
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const user = userEvent.setup();
        renderWithQueryClient(<Parametres />);

        await user.click(await screen.findByRole('button', { name: /repasser au pack essentiel/i }));

        expect(confirmSpy).toHaveBeenCalled();
        await waitFor(() => {
            expect(updateUserMock).toHaveBeenCalledWith({ data: { subscription_plan: 'essentiel' } });
        });
        expect(refreshSessionMock).toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('does not downgrade when the confirmation is cancelled', async () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'business' } }, refreshSession: refreshSessionMock });
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const user = userEvent.setup();
        renderWithQueryClient(<Parametres />);

        await user.click(await screen.findByRole('button', { name: /repasser au pack essentiel/i }));

        expect(updateUserMock).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
