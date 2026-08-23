import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BusinessList } from './BusinessList';

const { useAuthMock, useBusinessMock } = vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    useBusinessMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('../../contexts/BusinessContext', () => ({ useBusiness: useBusinessMock }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

const BUSINESS = { id: 'b1', name: 'CHEZ ANGEL', type: 'boutique' };

const renderPage = () => render(<BusinessList />, { wrapper: MemoryRouter });

describe('BusinessList — plan-based store limit', () => {
    beforeEach(() => {
        useAuthMock.mockReset();
        useBusinessMock.mockReset();
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
});
