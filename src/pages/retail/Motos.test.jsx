import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Motos } from './Motos';
import { renderWithQueryClient } from '../../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
        delete: vi.fn(() => builder),
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

const { toastSuccess, toastError } = vi.hoisted(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: toastSuccess, error: toastError },
}));

const MOTO = { id: 'moto-1', name: 'Yamaha DT', type: 'moto', price: 500000, stock_quantity: 5 };

describe('Motos stock adjustment', () => {
    beforeEach(() => {
        rpcMock.mockReset();
        fromMock.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ data: [MOTO], error: null }));
    });

    it('increments stock through the atomic adjust_stock RPC', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...MOTO, stock_quantity: 6 }, error: null });
        const user = userEvent.setup();

        renderWithQueryClient(<Motos />);
        await screen.findByText('Yamaha DT');

        await user.click(screen.getByTitle('Augmenter le stock'));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('adjust_stock', { p_product_id: 'moto-1', p_change: 1 });
        });
        await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    });

    it('decrements stock through the atomic adjust_stock RPC', async () => {
        rpcMock.mockResolvedValueOnce({ data: { ...MOTO, stock_quantity: 4 }, error: null });
        const user = userEvent.setup();

        renderWithQueryClient(<Motos />);
        await screen.findByText('Yamaha DT');

        await user.click(screen.getByTitle('Diminuer le stock'));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('adjust_stock', { p_product_id: 'moto-1', p_change: -1 });
        });
    });

    it('surfaces an error toast when the RPC rejects (e.g. product not found)', async () => {
        rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Produit introuvable') });
        const user = userEvent.setup();

        renderWithQueryClient(<Motos />);
        await screen.findByText('Yamaha DT');

        await user.click(screen.getByTitle('Augmenter le stock'));

        await waitFor(() => expect(toastError).toHaveBeenCalled());
    });
});
