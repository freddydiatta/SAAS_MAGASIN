import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BusinessList } from './BusinessList';

const { useAuthMock, useBusinessMock, fromMock } = vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useBusinessMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('../../contexts/BusinessContext', () => ({ useBusiness: useBusinessMock }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock } }));

function createInsertBuilder() {
    const builder = {
        insert: vi.fn(() => builder),
        select: vi.fn(() => Promise.resolve({ data: [{ id: 'new-biz' }], error: null })),
    };
    return builder;
}

const BUSINESS = { id: 'b1', name: 'CHEZ ANGEL', type: 'boutique' };

const renderPage = () => render(<BusinessList />, { wrapper: MemoryRouter });

describe('BusinessList — plan-based store limit', () => {
    beforeEach(() => {
        useAuthMock.mockReset();
        useBusinessMock.mockReset();
        fromMock.mockReset();
        useBusinessMock.mockReturnValue({
            businesses: [BUSINESS],
            selectBusiness: vi.fn(),
            loading: false,
            refreshBusinesses: vi.fn(),
            fetchError: '',
        });
    });

    it('hides "Créer un autre magasin" and shows the upsell for an Essentiel account with 1 store', () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'essentiel' } } });
        renderPage();

        expect(screen.queryByRole('button', { name: /créer un autre magasin/i })).not.toBeInTheDocument();
        expect(screen.getByText(/passer à l'abonnement business/i)).toBeInTheDocument();
    });

    it('shows "Créer un autre magasin" and no upsell for a Business account', () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'business' } } });
        renderPage();

        expect(screen.getByRole('button', { name: /créer un autre magasin/i })).toBeInTheDocument();
        expect(screen.queryByText(/passer à l'abonnement business/i)).not.toBeInTheDocument();
        expect(screen.getByText(/magasins illimités/i)).toBeInTheDocument();
    });

    it('shows the creation form directly for an Essentiel account with no store yet', () => {
        useAuthMock.mockReturnValue({ user: { user_metadata: { subscription_plan: 'essentiel' } } });
        useBusinessMock.mockReturnValue({
            businesses: [],
            selectBusiness: vi.fn(),
            loading: false,
            refreshBusinesses: vi.fn(),
            fetchError: '',
        });
        renderPage();

        expect(screen.getByText(/créer votre premier magasin/i)).toBeInTheDocument();
    });

    it('makes a new store inherit the account\'s already-paid subscription on the Business plan', async () => {
        const existingBusiness = {
            id: 'b1', name: 'CHEZ ANGEL', type: 'boutique',
            subscription_status: 'active', subscription_end_date: '2026-09-20T00:00:00.000Z',
        };
        useAuthMock.mockReturnValue({ user: { id: 'owner-1', user_metadata: { subscription_plan: 'business' } } });
        useBusinessMock.mockReturnValue({
            businesses: [existingBusiness],
            selectBusiness: vi.fn(),
            loading: false,
            refreshBusinesses: vi.fn().mockResolvedValue(),
            fetchError: '',
        });
        const builder = createInsertBuilder();
        fromMock.mockReturnValue(builder);

        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /créer un autre magasin/i }));
        await user.type(screen.getByPlaceholderText('Ex: Ma Super Boutique'), 'Deuxième Boutique');
        await user.click(screen.getByRole('button', { name: /créer et continuer/i }));

        await waitFor(() => {
            expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({
                subscription_status: 'active',
                subscription_end_date: '2026-09-20T00:00:00.000Z',
            })]);
        });
    });

    it('does not inherit a subscription for a brand-new Essentiel account (nothing to inherit yet)', async () => {
        useAuthMock.mockReturnValue({ user: { id: 'owner-1', user_metadata: { subscription_plan: 'essentiel' } } });
        useBusinessMock.mockReturnValue({
            businesses: [],
            selectBusiness: vi.fn(),
            loading: false,
            refreshBusinesses: vi.fn().mockResolvedValue(),
            fetchError: '',
        });
        const builder = createInsertBuilder();
        fromMock.mockReturnValue(builder);

        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByPlaceholderText('Ex: Ma Super Boutique'), 'Premier Magasin');
        await user.click(screen.getByRole('button', { name: /créer et continuer/i }));

        await waitFor(() => {
            expect(builder.insert).toHaveBeenCalledWith([expect.not.objectContaining({
                subscription_status: expect.anything(),
            })]);
        });
    });
});
