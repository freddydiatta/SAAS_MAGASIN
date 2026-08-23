import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Depenses } from './Depenses';
import { renderWithQueryClient } from '../test/testUtils';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

vi.mock('../contexts/BusinessContext', () => ({
    useBusiness: () => ({ selectedBusiness: { id: 'biz-1' }, currentMember: { role: 'owner', name: null } }),
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { email: 'owner@test.com' } }),
}));

const EXPENSE = { id: 'e1', category: 'transport', label: null, amount: 1500, created_at: '2026-08-24T09:00:00.000Z' };

describe('Depenses', () => {
    beforeEach(() => {
        fromMock.mockReset();
        fromMock.mockImplementation(() => createQueryBuilder({ data: [EXPENSE], error: null }));
    });

    it('lists expenses and shows the running total', async () => {
        renderWithQueryClient(<Depenses />);

        expect(await screen.findByText('Transport')).toBeInTheDocument();
        expect(screen.getByText('1 500 F')).toBeInTheDocument();
    });

    it('blocks a "Divers" expense with no description', async () => {
        const user = userEvent.setup();
        renderWithQueryClient(<Depenses />);
        await screen.findByText('Transport');

        await user.click(screen.getByRole('button', { name: /Ajouter une dépense/ }));
        await user.selectOptions(screen.getByRole('combobox'), 'divers');
        fireEvent.change(screen.getByPlaceholderText('Ex: 2000'), { target: { value: '1000' } });
        await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

        // No insert call was made — the zod refine on "divers" blocked it.
        expect(fromMock.mock.calls.filter(([table]) => table === 'expenses')).toHaveLength(1); // only the initial fetch
    });

    it('submits a valid expense', async () => {
        const builder = createQueryBuilder({ data: [EXPENSE], error: null });
        fromMock.mockImplementation(() => builder);
        const user = userEvent.setup();
        renderWithQueryClient(<Depenses />);
        await screen.findByText('Transport');

        await user.click(screen.getByRole('button', { name: /Ajouter une dépense/ }));
        await user.selectOptions(screen.getByRole('combobox'), 'transport');
        fireEvent.change(screen.getByPlaceholderText('Ex: 2000'), { target: { value: '3000' } });
        await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => {
            expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({ business_id: 'biz-1', amount: 3000 })]);
        });
    });
});
