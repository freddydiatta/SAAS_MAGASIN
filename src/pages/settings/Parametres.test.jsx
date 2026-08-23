import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parametres } from './Parametres';
import { renderWithQueryClient } from '../../test/testUtils';

const { useAuthMock, useBusinessMock, invokeMock, listCashiersMock } = vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useBusinessMock: vi.fn(),
    invokeMock: vi.fn(),
    listCashiersMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('../../contexts/BusinessContext', () => ({ useBusiness: useBusinessMock }));
vi.mock('../../lib/supabase', () => ({
    supabase: { functions: { invoke: invokeMock } },
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
});
