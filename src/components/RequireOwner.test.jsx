import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireOwner } from './RequireOwner';

const { useBusinessMock } = vi.hoisted(() => ({ useBusinessMock: vi.fn() }));

vi.mock('../contexts/BusinessContext', () => ({
    useBusiness: useBusinessMock,
}));

function renderWithRouter() {
    return render(
        <MemoryRouter initialEntries={['/settings']}>
            <Routes>
                <Route path="/settings" element={<RequireOwner><p>Contenu propriétaire</p></RequireOwner>} />
                <Route path="/dashboard" element={<p>Tableau de bord</p>} />
            </Routes>
        </MemoryRouter>
    );
}

describe('RequireOwner', () => {
    it('shows a loading spinner while membership is still resolving', () => {
        useBusinessMock.mockReturnValue({ currentMember: null, isCashier: false, memberResolved: false });
        renderWithRouter();

        expect(screen.queryByText('Contenu propriétaire')).not.toBeInTheDocument();
        expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
    });

    it('renders the protected content once resolved as owner', () => {
        useBusinessMock.mockReturnValue({ currentMember: { role: 'owner', name: null }, isCashier: false, memberResolved: true });
        renderWithRouter();

        expect(screen.getByText('Contenu propriétaire')).toBeInTheDocument();
    });

    it('redirects to the dashboard when resolved as a cashier', () => {
        useBusinessMock.mockReturnValue({ currentMember: { role: 'cashier', name: 'Awa' }, isCashier: true, memberResolved: true });
        renderWithRouter();

        expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
        expect(screen.queryByText('Contenu propriétaire')).not.toBeInTheDocument();
    });

    it('redirects instead of hanging forever when resolution finds no membership at all', () => {
        // Cas corrigé : memberResolved=true mais currentMember=null (ex. caissier désactivé
        // en cours de session) — avant, ceci était indiscernable du cas "en cours de
        // chargement" et laissait la page bloquée sur un spinner infini.
        useBusinessMock.mockReturnValue({ currentMember: null, isCashier: false, memberResolved: true });
        renderWithRouter();

        expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
        expect(screen.queryByText('Contenu propriétaire')).not.toBeInTheDocument();
    });
});
