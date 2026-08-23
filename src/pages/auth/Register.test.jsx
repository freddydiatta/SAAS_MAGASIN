import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Register } from './Register';

const { signUpMock } = vi.hoisted(() => ({ signUpMock: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
    supabase: { auth: { signUp: signUpMock } },
}));

const fillCredentials = async (user) => {
    await user.type(screen.getByPlaceholderText('vous@exemple.com'), 'nouveau@test.com');
    await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'password123');
    await user.type(screen.getAllByPlaceholderText('••••••••')[1], 'password123');
};

describe('Register', () => {
    beforeEach(() => {
        signUpMock.mockReset();
        signUpMock.mockResolvedValue({ error: null });
        localStorage.clear();
    });

    it('defaults to the Essentiel plan when no ?plan= is in the URL', async () => {
        const user = userEvent.setup();
        render(<Register />, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/register']}>{children}</MemoryRouter> });

        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));

        expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
            options: { data: expect.objectContaining({ subscription_plan: 'essentiel' }) },
        }));
    });

    it('picks up the plan from ?plan= in the URL', async () => {
        const user = userEvent.setup();
        render(<Register />, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/register?plan=business']}>{children}</MemoryRouter> });

        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));

        expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
            options: { data: expect.objectContaining({ subscription_plan: 'business' }) },
        }));
    });

    it('lets the user override the URL-provided plan by clicking the other card', async () => {
        const user = userEvent.setup();
        render(<Register />, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/register?plan=business']}>{children}</MemoryRouter> });

        await user.click(screen.getByText('Pack Essentiel'));
        await fillCredentials(user);
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));

        expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
            options: { data: expect.objectContaining({ subscription_plan: 'essentiel' }) },
        }));
    });
});
