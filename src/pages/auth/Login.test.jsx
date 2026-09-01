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

const { invokeMock, setSessionMock, rpcMock, navigateMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    setSessionMock: vi.fn(),
    rpcMock: vi.fn(),
    navigateMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
    supabase: {
        functions: { invoke: invokeMock },
        auth: { setSession: setSessionMock },
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
        invokeMock.mockReset();
        setSessionMock.mockReset();
        rpcMock.mockReset();
        navigateMock.mockReset();
        rpcMock.mockImplementation(() => fakeThenable({ data: null, error: null }));
        setSessionMock.mockResolvedValue({ error: null });
    });

    it('logs a real user in via owner-login and navigates to the dashboard', async () => {
        invokeMock.mockResolvedValue({
            data: { success: true, session: { access_token: 'at', refresh_token: 'rt' } },
            error: null,
        });
        const user = userEvent.setup();
        render(<Login />, { wrapper: MemoryRouter });

        await fillAndSubmit(user);

        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
        expect(invokeMock).toHaveBeenCalledWith('owner-login', {
            body: { email: 'owner@test.com', password: 'password123' },
        });
        expect(setSessionMock).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
        expect(rpcMock).toHaveBeenCalledWith('log_login_success');
    });

    it('shows an error message with the server-reported remaining attempts on wrong credentials', async () => {
        invokeMock.mockResolvedValue({
            data: { success: false, locked: false, remainingAttempts: 3 },
            error: null,
        });
        const user = userEvent.setup();
        render(<Login />, { wrapper: MemoryRouter });

        await fillAndSubmit(user);

        expect(await screen.findByText(/identifiants incorrects.*3 tentative/i)).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
        expect(setSessionMock).not.toHaveBeenCalled();
        expect(rpcMock).toHaveBeenCalledWith('log_failed_login', { p_email: 'owner@test.com' });
    });

    it('shows a lockout message and disables the button when the server reports the account is locked', async () => {
        const lockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        invokeMock.mockResolvedValue({
            data: { success: false, locked: true, lockedUntil },
            error: null,
        });
        const user = userEvent.setup();
        render(<Login />, { wrapper: MemoryRouter });

        await fillAndSubmit(user);

        expect(await screen.findByText(/trop de tentatives échouées/i)).toBeInTheDocument();
        expect(navigateMock).not.toHaveBeenCalled();
        // A lockout response is not a "wrong credentials" event — no failed-login audit entry here.
        expect(rpcMock).not.toHaveBeenCalledWith('log_failed_login', expect.anything());
        expect(screen.getByRole('button', { name: /réessayez dans/i })).toBeDisabled();
    });
});
