import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

function Harness({ onClose }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <button onClick={() => setIsOpen(true)}>Ouvrir</button>
            <Modal isOpen={isOpen} title="Titre modale" onClose={() => { setIsOpen(false); onClose?.(); }}>
                <button>Premier bouton</button>
                <button>Second bouton</button>
            </Modal>
        </div>
    );
}

describe('Modal accessibility', () => {
    it('exposes role=dialog, aria-modal and links the title via aria-labelledby', async () => {
        render(<Harness />);
        await userEvent.setup().click(screen.getByText('Ouvrir'));

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const titleId = dialog.getAttribute('aria-labelledby');
        expect(document.getElementById(titleId)).toHaveTextContent('Titre modale');
    });

    it('moves focus inside the modal when it opens', async () => {
        render(<Harness />);
        await userEvent.setup().click(screen.getByText('Ouvrir'));

        await screen.findByRole('dialog');
        await waitFor(() => {
            expect(document.activeElement).toHaveAccessibleName('Fermer');
        });
    });

    it('traps Tab focus within the modal (wraps from last back to first)', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByText('Ouvrir'));
        await screen.findByRole('dialog');

        const second = screen.getByText('Second bouton');
        second.focus();
        expect(document.activeElement).toBe(second);

        await user.tab();
        expect(document.activeElement).toHaveAccessibleName('Fermer');
    });

    it('traps Shift+Tab focus within the modal (wraps from first back to last)', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByText('Ouvrir'));
        const dialog = await screen.findByRole('dialog');

        const closeButton = screen.getByLabelText('Fermer');
        closeButton.focus();
        expect(document.activeElement).toBe(closeButton);

        await user.tab({ shift: true });
        expect(document.activeElement).toHaveTextContent('Second bouton');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes on Escape', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByText('Ouvrir'));
        await screen.findByRole('dialog');

        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('returns focus to the trigger element after closing', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        const trigger = screen.getByText('Ouvrir');
        await user.click(trigger);
        await screen.findByRole('dialog');

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        expect(document.activeElement).toBe(trigger);
    });

    it('keeps focus in a field while typing, even though onClose is a fresh function every render', async () => {
        // Regression test: most callers pass an inline onClose (e.g.
        // `onClose={() => setIsOpen(false)}`), and a controlled field inside
        // the modal re-renders its parent on every keystroke. If the focus
        // trap's effect depended on onClose's identity, that re-render used
        // to kick focus out of the field being typed into.
        function FormHarness() {
            const [isOpen, setIsOpen] = useState(false);
            const [value, setValue] = useState('');
            return (
                <div>
                    <button onClick={() => setIsOpen(true)}>Ouvrir</button>
                    <Modal isOpen={isOpen} title="Titre modale" onClose={() => setIsOpen(false)}>
                        <input aria-label="Description" value={value} onChange={(e) => setValue(e.target.value)} />
                    </Modal>
                </div>
            );
        }

        const user = userEvent.setup();
        render(<FormHarness />);
        await user.click(screen.getByText('Ouvrir'));
        const input = await screen.findByLabelText('Description');

        input.focus();
        await user.type(input, 'Réparation');

        expect(input).toHaveValue('Réparation');
        expect(document.activeElement).toBe(input);
    });
});
