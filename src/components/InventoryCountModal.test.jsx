import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryCountModal } from './InventoryCountModal';
import { renderWithQueryClient } from '../test/testUtils';

const { fetchInventoryItemsMock, saveInventoryCountsMock, validateInventoryMock } = vi.hoisted(() => ({
    fetchInventoryItemsMock: vi.fn(),
    saveInventoryCountsMock: vi.fn(),
    validateInventoryMock: vi.fn(),
}));

vi.mock('../services/inventoriesService', () => ({
    fetchInventoryItems: fetchInventoryItemsMock,
    saveInventoryCounts: saveInventoryCountsMock,
    validateInventory: validateInventoryMock,
}));

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const DRAFT_INVENTORY = { id: 'inv1', status: 'draft' };
const ITEMS = [
    { id: 'item1', product_name: 'Coca-Cola 33cl', expected_quantity: 20, counted_quantity: null },
    { id: 'item2', product_name: 'Fanta 33cl', expected_quantity: 10, counted_quantity: 8 },
];

describe('InventoryCountModal', () => {
    beforeEach(() => {
        fetchInventoryItemsMock.mockReset();
        saveInventoryCountsMock.mockReset();
        validateInventoryMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        fetchInventoryItemsMock.mockResolvedValue(ITEMS);
    });

    it('shows expected vs counted quantities and the resulting écart', async () => {
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );

        await screen.findByText('Coca-Cola 33cl');
        // Fanta already has a saved count of 8 vs an expected 10 -> écart -2
        expect(screen.getByDisplayValue('8')).toBeInTheDocument();
        expect(screen.getByText('-2')).toBeInTheDocument();
    });

    it('saves only the changed counts', async () => {
        saveInventoryCountsMock.mockResolvedValueOnce();
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        const inputs = screen.getAllByRole('spinbutton');
        // Coca-Cola (no saved count yet) is the first row alphabetically
        await user.type(inputs[0], '19');

        await user.click(screen.getByRole('button', { name: 'Enregistrer le comptage' }));

        // React Query v5 appelle mutationFn avec un second argument (contexte) ;
        // seuls les items qu'on a passés nous importent ici.
        await waitFor(() => expect(saveInventoryCountsMock.mock.calls[0]?.[0]).toEqual([{ id: 'item1', countedQuantity: 19 }]));
    });

    it('saves unsaved changes then validates the inventory, and closes on success', async () => {
        saveInventoryCountsMock.mockResolvedValueOnce();
        validateInventoryMock.mockResolvedValueOnce({ id: 'inv1', status: 'validated' });
        const onClose = vi.fn();
        const onValidated = vi.fn();
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={onClose} inventory={DRAFT_INVENTORY} onValidated={onValidated} />
        );
        await screen.findByText('Coca-Cola 33cl');

        const inputs = screen.getAllByRole('spinbutton');
        await user.type(inputs[0], '20');

        await user.click(screen.getByRole('button', { name: /Valider l'inventaire/ }));

        await waitFor(() => expect(saveInventoryCountsMock.mock.calls[0]?.[0]).toEqual([{ id: 'item1', countedQuantity: 20 }]));
        await waitFor(() => expect(validateInventoryMock).toHaveBeenCalledWith({ inventoryId: 'inv1' }));
        await waitFor(() => expect(onValidated).toHaveBeenCalled());
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('shows a read-only view with no inputs once the inventory is validated', async () => {
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={{ id: 'inv1', status: 'validated' }} />
        );

        await screen.findByText('Coca-Cola 33cl');
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: /Valider l'inventaire/ })).not.toBeInTheDocument();
    });

    it('does not wipe an in-progress count when the background refetch fires (15s auto-refresh)', async () => {
        const user = userEvent.setup();
        const { queryClient } = renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        const inputs = screen.getAllByRole('spinbutton');
        await user.type(inputs[0], '19');
        expect(inputs[0]).toHaveValue(19);

        // Simule le refetch automatique de l'app (refetchInterval: 15000)
        // pendant que la modale reste ouverte — ne doit pas écraser la
        // saisie en cours de l'utilisateur.
        await queryClient.invalidateQueries({ queryKey: ['inventory_items', 'inv1'] });
        await waitFor(() => expect(fetchInventoryItemsMock).toHaveBeenCalledTimes(2));

        expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(19);
    });
});
