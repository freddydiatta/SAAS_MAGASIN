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

const { useProductsMock } = vi.hoisted(() => ({ useProductsMock: vi.fn() }));
vi.mock('../hooks/useProducts', () => ({ useProducts: useProductsMock }));

// Fausse implémentation minimale : la caméra/ZXing sont déjà couverts par
// BarcodeScannerModal.test.jsx — ici on ne teste que ce que
// InventoryCountModal.jsx fait d'un code scanné (retrouver l'article,
// saisir sa quantité, enchaîner sur le suivant).
const { scannerSpy } = vi.hoisted(() => ({ scannerSpy: { onScan: null } }));
vi.mock('./BarcodeScannerModal', () => ({
    BarcodeScannerModal: (props) => {
        scannerSpy.onScan = props.onScan;
        return props.isOpen ? <div data-testid="barcode-scanner-mock" /> : null;
    },
}));

const DRAFT_INVENTORY = { id: 'inv1', status: 'draft', business_id: 'biz-1' };
const ITEMS = [
    { id: 'item1', product_id: 'p1', product_name: 'Coca-Cola 33cl', expected_quantity: 20, counted_quantity: null },
    { id: 'item2', product_id: 'p2', product_name: 'Fanta 33cl', expected_quantity: 10, counted_quantity: 8 },
];
const PRODUCTS = [
    { id: 'p1', name: 'Coca-Cola 33cl', barcode: '3017620422003' },
    { id: 'p2', name: 'Fanta 33cl', barcode: '5449000000996' },
];

describe('InventoryCountModal', () => {
    beforeEach(() => {
        fetchInventoryItemsMock.mockReset();
        saveInventoryCountsMock.mockReset();
        validateInventoryMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        useProductsMock.mockReset();
        scannerSpy.onScan = null;
        fetchInventoryItemsMock.mockResolvedValue(ITEMS);
        useProductsMock.mockReturnValue({ data: PRODUCTS });
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

describe('InventoryCountModal barcode scanning', () => {
    beforeEach(() => {
        fetchInventoryItemsMock.mockReset();
        saveInventoryCountsMock.mockReset();
        validateInventoryMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        useProductsMock.mockReset();
        scannerSpy.onScan = null;
        fetchInventoryItemsMock.mockResolvedValue(ITEMS);
        useProductsMock.mockReturnValue({ data: PRODUCTS });
    });

    it('shows the scanned article with its théorique, pre-filled from any already-saved count', async () => {
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        await user.click(screen.getByRole('button', { name: 'Scanner' }));
        scannerSpy.onScan('5449000000996'); // Fanta, already counted at 8

        expect(await screen.findByText('Théorique : 10')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Qté')).toHaveValue(8);
    });

    it('saves just the scanned item on confirm and re-opens the scanner for the next one', async () => {
        saveInventoryCountsMock.mockResolvedValueOnce();
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        await user.click(screen.getByRole('button', { name: 'Scanner' }));
        scannerSpy.onScan('3017620422003'); // Coca-Cola, no saved count yet
        await screen.findByText('Théorique : 20');

        await user.clear(screen.getByPlaceholderText('Qté'));
        await user.type(screen.getByPlaceholderText('Qté'), '19');
        await user.click(screen.getByRole('button', { name: 'Valider' }));

        await waitFor(() => expect(saveInventoryCountsMock.mock.calls[0]?.[0]).toEqual([{ id: 'item1', countedQuantity: 19 }]));
        // back to scanning mode, ready for the next item
        expect(screen.queryByText('Théorique : 20')).not.toBeInTheDocument();
        expect(screen.getByTestId('barcode-scanner-mock')).toBeInTheDocument();
    });

    it('confirms with the Enter key', async () => {
        saveInventoryCountsMock.mockResolvedValueOnce();
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        await user.click(screen.getByRole('button', { name: 'Scanner' }));
        scannerSpy.onScan('3017620422003');
        await screen.findByText('Théorique : 20');

        await user.clear(screen.getByPlaceholderText('Qté'));
        await user.type(screen.getByPlaceholderText('Qté'), '20{Enter}');

        await waitFor(() => expect(saveInventoryCountsMock.mock.calls[0]?.[0]).toEqual([{ id: 'item1', countedQuantity: 20 }]));
    });

    it('shows an error toast and stays in scanning mode when the barcode matches no product', async () => {
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        await user.click(screen.getByRole('button', { name: 'Scanner' }));
        scannerSpy.onScan('0000000000000');

        expect(toastErrorMock).toHaveBeenCalledWith('Aucun produit ne correspond à ce code-barres.');
        expect(screen.queryByPlaceholderText('Qté')).not.toBeInTheDocument();
    });

    it('cancels (Escape) without saving and returns to scanning mode', async () => {
        const user = userEvent.setup();
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={DRAFT_INVENTORY} />
        );
        await screen.findByText('Coca-Cola 33cl');

        await user.click(screen.getByRole('button', { name: 'Scanner' }));
        scannerSpy.onScan('3017620422003');
        await screen.findByText('Théorique : 20');

        await user.type(screen.getByPlaceholderText('Qté'), '{Escape}');

        expect(screen.queryByText('Théorique : 20')).not.toBeInTheDocument();
        expect(saveInventoryCountsMock).not.toHaveBeenCalled();
    });

    it('does not show the Scanner button once the inventory is validated', async () => {
        renderWithQueryClient(
            <InventoryCountModal isOpen onClose={() => {}} inventory={{ id: 'inv1', status: 'validated', business_id: 'biz-1' }} />
        );

        await screen.findByText('Coca-Cola 33cl');
        expect(screen.queryByRole('button', { name: 'Scanner' })).not.toBeInTheDocument();
    });
});
