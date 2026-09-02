import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoriqueVentes } from './HistoriqueVentes';
import { renderWithQueryClient } from '../../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { rpcMock, fromMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
    supabase: { from: fromMock, rpc: rpcMock },
}));

vi.mock('../../contexts/BusinessContext', () => ({
    useBusiness: () => ({ selectedBusiness: { id: 'biz-1' } }),
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { email: 'caissier@test.com' } }),
}));

const RECEIPT = {
    id: 'r1',
    business_id: 'biz-1',
    customer_name: null,
    customer_phone: null,
    total_amount: 1000,
    status: 'completed',
    payment_method: 'cash',
    created_at: '2026-08-20T10:00:00.000Z',
    sales: [
        { id: 's1', product_id: 'p1', quantity: 1, total_price: 1000, products: { name: 'Casque Moto', type: 'moto' } },
    ],
};

describe('HistoriqueVentes payment method badge', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        fromMock.mockReset();
    });

    it('labels a credit sale distinctly instead of falling back to Espèces', async () => {
        const creditReceipt = { ...RECEIPT, id: 'r2', payment_method: 'credit' };
        fromMock.mockImplementation(() => createQueryBuilder({ data: [creditReceipt], error: null }));

        renderWithQueryClient(<HistoriqueVentes />);
        await screen.findByText('Casque Moto');

        expect(screen.getByText(/Crédit/)).toBeInTheDocument();
        expect(screen.queryByText(/Espèces/)).not.toBeInTheDocument();
    });
});

describe('HistoriqueVentes cancel/modify', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        fromMock.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ data: [RECEIPT], error: null }));
    });

    it('cancels a sale through the atomic cancel_sale RPC', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...RECEIPT, status: 'cancelled' }, error: null });
        const user = userEvent.setup();

        renderWithQueryClient(<HistoriqueVentes />);
        await screen.findByText('Casque Moto');

        await user.click(screen.getByTitle('Annuler Vente'));
        await user.click(await screen.findByRole('button', { name: 'Oui, annuler' }));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('cancel_sale', {
                p_receipt_id: 'r1',
                p_user_email: 'caissier@test.com',
            });
        });
        expect(await screen.findByText(/Vente annulée avec succès/)).toBeInTheDocument();
    });

    it('shows an error toast when cancel_sale rejects (e.g. already cancelled)', async () => {
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Cette vente est déjà annulée.') });
        const user = userEvent.setup();

        renderWithQueryClient(<HistoriqueVentes />);
        await screen.findByText('Casque Moto');

        await user.click(screen.getByTitle('Annuler Vente'));
        await user.click(await screen.findByRole('button', { name: 'Oui, annuler' }));

        expect(await screen.findByText(/erreur est survenue lors de l'annulation/)).toBeInTheDocument();
    });

    it('sends the updated quantity through the atomic modify_sale RPC', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...RECEIPT, total_amount: 2000 }, error: null });
        const user = userEvent.setup();

        renderWithQueryClient(<HistoriqueVentes />);
        await screen.findByText('Casque Moto');

        await user.click(screen.getByTitle('Modifier'));
        const heading = await screen.findByText('Modifier la Vente');
        const modal = heading.closest('.bg-panel');

        // buttons inside the modal, in DOM order: close(x), qty-minus, qty-plus, Annuler, Enregistrer
        const modalButtons = within(modal).getAllByRole('button');
        await user.click(modalButtons[2]); // "+" on the single line item: 1 -> 2

        await user.click(within(modal).getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('modify_sale', {
                p_receipt_id: 'r1',
                p_user_email: 'caissier@test.com',
                p_items: [
                    {
                        sale_id: 's1',
                        product_id: 'p1',
                        name: 'Casque Moto',
                        original_qty: 1,
                        new_qty: 2,
                        price: 1000,
                    },
                ],
            });
        });
        expect(await screen.findByText(/Vente modifiée avec succès/)).toBeInTheDocument();
    });
});
