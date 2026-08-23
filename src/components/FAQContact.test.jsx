import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAQContact } from './FAQContact';

const { submitContactMessageMock } = vi.hoisted(() => ({ submitContactMessageMock: vi.fn() }));

vi.mock('../services/contactService', () => ({
    submitContactMessage: submitContactMessageMock,
}));

describe('FAQContact', () => {
    beforeEach(() => {
        submitContactMessageMock.mockReset();
    });

    it('opens the first FAQ item by default and toggles others on click', async () => {
        const user = userEvent.setup();
        render(<FAQContact />);

        // First question's answer is visible by default.
        expect(screen.getByText(/La caisse continue de fonctionner hors-ligne/)).toBeInTheDocument();

        await user.click(screen.getByText("Combien coûte l'abonnement ?"));
        expect(screen.getByText(/Consultez la section Tarifs/)).toBeInTheDocument();
        // Opening a different question closes the first one.
        expect(screen.queryByText(/La caisse continue de fonctionner hors-ligne/)).not.toBeInTheDocument();
    });

    it('submits the contact form and shows a confirmation', async () => {
        submitContactMessageMock.mockResolvedValueOnce({ success: true });
        const user = userEvent.setup();
        render(<FAQContact />);

        await user.type(screen.getByPlaceholderText('Ex: Awa Diop'), 'Awa Diop');
        await user.type(screen.getByPlaceholderText('Ex: +221 77 123 45 67'), '771234567');
        await user.type(screen.getByPlaceholderText('Posez votre question...'), 'Est-ce disponible à Thiès ?');
        await user.click(screen.getByRole('button', { name: /Envoyer/ }));

        expect(await screen.findByText('Message envoyé !')).toBeInTheDocument();
        expect(submitContactMessageMock).toHaveBeenCalledWith({
            name: 'Awa Diop', contactInfo: '771234567', message: 'Est-ce disponible à Thiès ?',
        });
    });

    it('shows an error message when the submission fails', async () => {
        submitContactMessageMock.mockRejectedValueOnce(new Error('Load failed'));
        const user = userEvent.setup();
        render(<FAQContact />);

        await user.type(screen.getByPlaceholderText('Ex: Awa Diop'), 'Awa Diop');
        await user.type(screen.getByPlaceholderText('Ex: +221 77 123 45 67'), '771234567');
        await user.type(screen.getByPlaceholderText('Posez votre question...'), 'Une question');
        await user.click(screen.getByRole('button', { name: /Envoyer/ }));

        expect(await screen.findByText('Load failed')).toBeInTheDocument();
        expect(screen.queryByText('Message envoyé !')).not.toBeInTheDocument();
    });
});
