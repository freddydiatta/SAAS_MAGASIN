import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';

vi.mock('../contexts/BusinessContext', () => ({
    useBusiness: () => ({ selectedBusiness: { id: 'biz-1' } }),
}));

const { useProductsMock } = vi.hoisted(() => ({ useProductsMock: vi.fn() }));
vi.mock('../hooks/useProducts', () => ({ useProducts: useProductsMock }));

const PRODUCTS = [
    { id: 'p1', name: 'Coca-Cola 33cl', cost_price: 300 },
];

describe('CreatePurchaseOrderModal', () => {
    beforeEach(() => {
        useProductsMock.mockReset();
        useProductsMock.mockReturnValue({ data: PRODUCTS });
    });

    it('submits a unit-mode item as-is (default mode)', async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        render(<CreatePurchaseOrderModal isOpen onClose={() => {}} onSubmit={onSubmit} isSaving={false} suppliers={[]} />);

        // Le premier combobox est le sélecteur de fournisseur, le second
        // le sélecteur de produit de la ligne d'article.
        await user.selectOptions(screen.getAllByRole('combobox')[1], 'p1');
        await user.clear(screen.getByPlaceholderText('Qté'));
        await user.type(screen.getByPlaceholderText('Qté'), '5');

        await user.click(screen.getByRole('button', { name: 'Créer le bon de commande' }));

        expect(onSubmit).toHaveBeenCalledWith({
            supplierId: '',
            items: [{ productId: 'p1', quantity: 5, unitCost: 300 }],
        });
    });

    it('converts a pack purchase into the resulting unit quantity and per-unit cost', async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        render(<CreatePurchaseOrderModal isOpen onClose={() => {}} onSubmit={onSubmit} isSaving={false} suppliers={[]} />);

        // Le premier combobox est le sélecteur de fournisseur, le second
        // le sélecteur de produit de la ligne d'article.
        await user.selectOptions(screen.getAllByRole('combobox')[1], 'p1');
        await user.click(screen.getByRole('button', { name: 'Pack' }));

        await user.clear(screen.getByPlaceholderText('Nb de packs'));
        await user.type(screen.getByPlaceholderText('Nb de packs'), '3');
        await user.type(screen.getByPlaceholderText('Unités/pack'), '24');
        await user.type(screen.getByPlaceholderText('Prix du pack'), '6000');

        // 3 packs x 24 units = 72 units ; 6000 F / 24 = 250 F/unit
        expect(await screen.findByText('= 72 unités à 250 F/unité')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Créer le bon de commande' }));

        expect(onSubmit).toHaveBeenCalledWith({
            supplierId: '',
            items: [{ productId: 'p1', quantity: 72, unitCost: 250 }],
        });
    });

    it('resets the pack fields to a fresh row after submitting', async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        render(<CreatePurchaseOrderModal isOpen onClose={() => {}} onSubmit={onSubmit} isSaving={false} suppliers={[]} />);

        // Le premier combobox est le sélecteur de fournisseur, le second
        // le sélecteur de produit de la ligne d'article.
        await user.selectOptions(screen.getAllByRole('combobox')[1], 'p1');
        await user.click(screen.getByRole('button', { name: 'Pack' }));
        await user.clear(screen.getByPlaceholderText('Nb de packs'));
        await user.type(screen.getByPlaceholderText('Nb de packs'), '2');
        await user.type(screen.getByPlaceholderText('Unités/pack'), '12');
        await user.type(screen.getByPlaceholderText('Prix du pack'), '3000');

        await user.click(screen.getByRole('button', { name: 'Créer le bon de commande' }));

        // back to a single, blank "unit" mode row
        expect(screen.getByRole('button', { name: 'Unité' })).toHaveClass('bg-accent');
        expect(screen.queryByPlaceholderText('Nb de packs')).not.toBeInTheDocument();
    });
});
