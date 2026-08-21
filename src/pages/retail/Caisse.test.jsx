import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Caisse } from './Caisse';
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
    useAuth: () => ({ user: { email: 'test@test.com' } }),
}));

const { saveOfflineSaleMock } = vi.hoisted(() => ({ saveOfflineSaleMock: vi.fn() }));

vi.mock('../../services/syncService', () => ({
    saveOfflineSale: saveOfflineSaleMock,
}));

const PRODUCT = { id: 'p1', name: 'Casque Moto', type: 'moto', price: 1000, stock_quantity: 5 };

async function addProductAndPay(user, { amount = '1000' } = {}) {
    await screen.findByText('Casque Moto');
    await user.click(screen.getByText('Casque Moto'));
    await user.type(screen.getByPlaceholderText('0'), amount);
}

describe('Caisse checkout', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

    beforeEach(() => {
        rpcMock.mockReset();
        fromMock.mockReset();
        saveOfflineSaleMock.mockReset();
        onlineSpy.mockReturnValue(true);
        fromMock.mockImplementation(() => createQueryBuilder({ data: [PRODUCT], error: null }));
    });

    it('processes an online sale through the atomic process_sale RPC and clears the cart', async () => {
        rpcMock.mockResolvedValueOnce({
            data: { id: 'receipt-1', total_amount: 1000 },
            error: null,
        });
        const user = userEvent.setup();

        renderWithQueryClient(<Caisse />);
        await addProductAndPay(user);

        await user.click(screen.getByRole('button', { name: 'Encaisser' }));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('process_sale', {
                p_business_id: 'biz-1',
                p_customer_name: null,
                p_customer_phone: null,
                p_payment_method: 'cash',
                p_items: [{ product_id: 'p1', quantity: 1 }],
            });
        });

        expect(await screen.findByText(/Vente encaissée avec succès/)).toBeInTheDocument();
        // cart cleared -> back to empty state
        expect(await screen.findByText('Le panier est vide')).toBeInTheDocument();
    });

    it('shows an error and keeps the cart when the RPC rejects (e.g. insufficient stock)', async () => {
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: new Error('Stock insuffisant pour "Casque Moto": disponible 0, demandé 1'),
        });
        const user = userEvent.setup();

        renderWithQueryClient(<Caisse />);
        await addProductAndPay(user);

        await user.click(screen.getByRole('button', { name: 'Encaisser' }));

        expect(await screen.findByText(/Erreur lors de l'encaissement/)).toBeInTheDocument();
        // cart untouched -> item still there, not the empty state
        expect(screen.queryByText('Le panier est vide')).not.toBeInTheDocument();
    });

    it('queues the sale offline instead of calling process_sale when there is no connection', async () => {
        onlineSpy.mockReturnValue(false);
        saveOfflineSaleMock.mockResolvedValueOnce({ id: 'temp-1', sales: [] });
        const user = userEvent.setup();

        renderWithQueryClient(<Caisse />);
        await addProductAndPay(user);

        await user.click(screen.getByRole('button', { name: 'Encaisser' }));

        await waitFor(() => {
            expect(saveOfflineSaleMock).toHaveBeenCalledWith(
                'biz-1',
                [expect.objectContaining({ id: 'p1', quantity: 1 })],
                '',
                '',
                1000,
                'cash'
            );
        });
        expect(rpcMock).not.toHaveBeenCalled();
        expect(await screen.findByText(/enregistrée hors-ligne/)).toBeInTheDocument();
    });
});
