import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Login } from './Login';

// supabase-js query builders (.from()/.rpc()) are "thenables" — they only
// implement .then(onFulfilled, onRejected), not the full Promise interface
// (no .catch()/.finally()). This mock deliberately mirrors that shape
// instead of returning a real Promise, so a regression like calling
// `.catch()` directly on the result fails the test instead of shipping to
// production silently (see the 2026-08-22 outage: it broke every login).
function fakeThenable(result) {
    return {
        then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
}

const { signInWithPasswordMock, rpcMock, navigateMock } = vi.hoisted(() => ({
    signInWithPasswordMock: vi.fn(),
    rpcMock: vi.fn(),
    navigateMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: { signInWithPassword: signInWithPasswordMock },
        rpc: rpcMock,
    },
}));

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, useNavigate: () => navigateMock };
});

const fillAndSubmit = async (user, { email = 'owner@test.com', password = 'password123' } = {}) => {
    await user.type(screen.getByPlaceholderText('vous@exemple.com'), email);
    await user.type(screen.getByPlaceholderText('••••••••'), password);
    await user.click(screen.getByRole('button', { name: /se connecter/i }));
};

describe('Login', () => {
    beforeEach(() => {
        signInWithPasswordMock.mockReset();
        rpcMock.mockReset();
        navigateMock.mockReset();
        rpcMock.mockImplementation(() => fakeThenable({ data: null, error: null }));
    });

    it('logs a real user in and navigates to the dashboard', async () => {
        signInWithPasswordMock.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        render(<Login />, { wrapper: MemoryRouter });

        await fillAndSubmit(user);

        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
        expect(rpcMock).toHaveBeenCalledWith('log_login_success');
    });

    it('shows an error message and does not navigate on wrong credentials', async () => {
        signInWithPasswordMock.mockResolvedValue({ error: new Error('Invalid login credentials') });
        const user = userEvent.setup();
        render(<Login />, { wrapper: MemoryRouter });

        await fillAndSubmit(user);

        expect(await screen.findByText(/identifiants incorrects/i)).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
        expect(rpcMock).toHaveBeenCalledWith('log_failed_login', { p_email: 'owner@test.com' });
    });
});
