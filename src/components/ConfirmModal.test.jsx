import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
    it('renders the title, message and both actions', () => {
        render(
            <ConfirmModal
                isOpen
                title="Supprimer ce fournisseur ?"
                message="Cette action est irréversible."
                confirmLabel="Oui, supprimer"
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(screen.getByText('Supprimer ce fournisseur ?')).toBeInTheDocument();
        expect(screen.getByText('Cette action est irréversible.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Oui, supprimer' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    });

    it('calls onConfirm and onCancel from the right buttons', async () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        const user = userEvent.setup();
        render(
            <ConfirmModal isOpen title="Confirmer ?" message="..." onConfirm={onConfirm} onCancel={onCancel} />
        );

        await user.click(screen.getByRole('button', { name: 'Confirmer' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Annuler' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disables the confirm button and shows a waiting label while confirming', () => {
        render(
            <ConfirmModal isOpen title="Confirmer ?" message="..." isConfirming onConfirm={() => {}} onCancel={() => {}} />
        );

        const button = screen.getByRole('button', { name: 'Patientez...' });
        expect(button).toBeDisabled();
    });

    it('renders nothing when closed', () => {
        const { container } = render(
            <ConfirmModal isOpen={false} title="x" message="x" onConfirm={() => {}} onCancel={() => {}} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
