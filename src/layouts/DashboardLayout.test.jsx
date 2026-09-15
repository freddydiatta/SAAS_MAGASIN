import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './DashboardLayout';

const { businessState } = vi.hoisted(() => ({
    businessState: { selectedBusiness: null, currentMember: null, isCashier: false },
}));

vi.mock('../contexts/BusinessContext', () => ({ useBusiness: () => businessState }));
vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'u1', email: 'owner@test.com', user_metadata: {} }, signOut: vi.fn() }),
}));
vi.mock('../components/BillingModal', () => ({ BillingModal: () => null }));
vi.mock('../components/SwitchUserModal', () => ({ SwitchUserModal: () => null }));
vi.mock('../components/ReturnToOwnerModal', () => ({ ReturnToOwnerModal: () => null }));
vi.mock('../components/OfflineStatusBadge', () => ({ OfflineStatusBadge: () => null }));

const renderAt = (path) => render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<DashboardLayout />}>
                    <Route path="/dashboard/*" element={<div>page</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>
);

const sidebar = () => screen.getByRole('navigation');
// Le libellé est le dernier élément du lien (le premier est l'icône emoji).
const visibleLinks = () => within(sidebar()).getAllByRole('link')
    .map((link) => link.lastElementChild.textContent.trim());

describe('DashboardLayout — barre latérale', () => {
    beforeEach(() => {
        localStorage.clear();
        businessState.selectedBusiness = { id: 'b1', name: 'Dépôt', type: 'boutique', subscription_status: 'active' };
        businessState.isCashier = false;
    });

    it('ne montre que les 5 accès du quotidien, le reste replié sous « Paramètres »', () => {
        renderAt('/dashboard');

        expect(visibleLinks()).toEqual(['Aperçu', 'Caisse', 'Stock', 'Dettes', 'Historique']);
        const toggle = within(sidebar()).getByRole('button', { name: /Paramètres/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('déplie les pages secondaires au clic', async () => {
        renderAt('/dashboard');

        await userEvent.click(within(sidebar()).getByRole('button', { name: /Paramètres/ }));

        expect(visibleLinks()).toEqual([
            'Aperçu', 'Caisse', 'Stock', 'Dettes', 'Historique',
            'Inventaires', 'Dépenses', 'Fournisseurs', 'Finances', 'Sécurité', 'Affiliation', 'Abonnement et équipe',
        ]);
    });

    it('ouvre le groupe tout seul quand on est sur l\'une de ses pages', () => {
        // sinon l'entrée active serait cachée et on ne saurait plus où l'on est
        renderAt('/dashboard/finances');

        const active = within(sidebar()).getByRole('link', { name: /Finances/ });
        expect(active).toHaveAttribute('aria-current', 'page');
    });

    it('garde les pages réservées au propriétaire hors de portée d\'un caissier', async () => {
        businessState.isCashier = true;
        renderAt('/dashboard');

        await userEvent.click(within(sidebar()).getByRole('button', { name: /Paramètres/ }));

        const labels = visibleLinks();
        expect(labels).toContain('Inventaires');
        expect(labels).not.toContain('Finances');
        expect(labels).not.toContain('Fournisseurs');
        expect(labels).not.toContain('Abonnement et équipe');
    });
});
