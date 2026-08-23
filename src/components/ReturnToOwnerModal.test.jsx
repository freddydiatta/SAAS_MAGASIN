import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReturnToOwnerModal } from './ReturnToOwnerModal';
import { renderWithQueryClient } from '../test/testUtils';

const { switchBackToOwnerMock } = vi.hoisted(() => ({ switchBackToOwnerMock: vi.fn() }));

vi.mock('../contexts/BusinessContext', () => ({
    useBusiness: () => ({
        switchBackToOwner: switchBackToOwnerMock,
        getStashedOwnerEmail: () => 'owner@test.com',
    }),
}));

describe('ReturnToOwnerModal', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

    beforeEach(() => {
        switchBackToOwnerMock.mockReset();
        onlineSpy.mockReturnValue(true);
    });

    it('shows a generic wrong-password message when online and the password is rejected', async () => {
        onlineSpy.mockReturnValue(true);
        switchBackToOwnerMock.mockRejectedValueOnce(new Error('Invalid login credentials'));
        const user = userEvent.setup();

        renderWithQueryClient(<ReturnToOwnerModal isOpen onClose={() => {}} />);
        await user.type(screen.getByPlaceholderText('Mot de passe'), 'wrong-password');
        await user.click(screen.getByRole('button', { name: 'Confirmer' }));

        expect(await screen.findByText('Mot de passe incorrect.')).toBeInTheDocument();
    });

    it('shows a network-specific message instead of "wrong password" when offline', async () => {
        onlineSpy.mockReturnValue(false);
        switchBackToOwnerMock.mockRejectedValueOnce(new Error('Load failed'));
        const user = userEvent.setup();

        renderWithQueryClient(<ReturnToOwnerModal isOpen onClose={() => {}} />);
        await user.type(screen.getByPlaceholderText('Mot de passe'), 'correct-password');
        await user.click(screen.getByRole('button', { name: 'Confirmer' }));

        expect(await screen.findByText('Connexion internet requise pour revenir au compte propriétaire.')).toBeInTheDocument();
        expect(screen.queryByText('Mot de passe incorrect.')).not.toBeInTheDocument();
    });
});
