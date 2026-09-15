import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const { getSessionMock, getUserMock, onAuthStateChangeMock } = vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    getUserMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    AUTH_STORAGE_KEY: 'sb-test-auth-token',
    supabase: {
        auth: {
            getSession: getSessionMock,
            getUser: getUserMock,
            onAuthStateChange: onAuthStateChangeMock,
        },
        rpc: vi.fn(),
    },
}));

const STORED = {
    access_token: 'expired',
    refresh_token: 'still-valid',
    expires_at: Math.floor(Date.now() / 1000) - 7200, // expiré depuis deux heures
    user: { id: 'owner-1', email: 'owner@test.com' },
};

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
const onlineSpy = vi.spyOn(navigator, 'onLine', 'get');

describe('AuthContext — ouverture sans réseau', () => {
    let authListener;

    beforeEach(() => {
        localStorage.clear();
        getSessionMock.mockReset();
        getUserMock.mockReset();
        onAuthStateChangeMock.mockReset();
        onAuthStateChangeMock.mockImplementation((callback) => {
            authListener = callback;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
        });
        onlineSpy.mockReturnValue(false);
    });

    afterEach(() => {
        onlineSpy.mockReturnValue(true);
    });

    it('reprend la session enregistrée quand l\'accès n\'a pas pu être renouvelé', async () => {
        // le cas du matin : dernier passage en ligne la veille, accès expiré,
        // pas de réseau. supabase-js répond « pas de session » mais la garde
        localStorage.setItem('sb-test-auth-token', JSON.stringify(STORED));
        getSessionMock.mockResolvedValue({ data: { session: null }, error: new Error('Failed to fetch') });

        const { result } = renderHook(() => useAuth(), { wrapper });
        // le fournisseur n'affiche ses enfants qu'une fois la session résolue
        await waitFor(() => expect(result.current).not.toBeNull());

        expect(result.current.user).toEqual({ id: 'owner-1', email: 'owner@test.com' });
    });

    it('s\'ouvre sans attendre les ~25 s de tentatives de renouvellement', async () => {
        // en vrai, supabase-js ne répond qu'après avoir renoncé : écran blanc
        localStorage.setItem('sb-test-auth-token', JSON.stringify(STORED));
        getSessionMock.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => expect(result.current).not.toBeNull(), { timeout: 500 });

        expect(result.current.user?.id).toBe('owner-1');
        expect(getUserMock).not.toHaveBeenCalled();
    });

    it('n\'attend que quelques secondes quand le réseau est là mais ne répond pas', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            onlineSpy.mockReturnValue(true);
            localStorage.setItem('sb-test-auth-token', JSON.stringify(STORED));
            getSessionMock.mockReturnValue(new Promise(() => {}));

            const { result } = renderHook(() => useAuth(), { wrapper });
            await act(() => vi.advanceTimersByTimeAsync(3100));
            await waitFor(() => expect(result.current).not.toBeNull());

            expect(result.current.user?.id).toBe('owner-1');
            expect(getUserMock).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('attend supabase-js en ligne quand aucune session n\'est enregistrée', async () => {
        onlineSpy.mockReturnValue(true);
        getSessionMock.mockResolvedValue({ data: { session: { ...STORED, user: { id: 'fresh' } } } });
        getUserMock.mockResolvedValue({ data: { user: { id: 'fresh' } }, error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => expect(result.current).not.toBeNull());

        expect(result.current.user?.id).toBe('fresh');
    });

    it('ne se fait pas déconnecter par l\'annonce d\'une session vide sans réseau', async () => {
        localStorage.setItem('sb-test-auth-token', JSON.stringify(STORED));
        getSessionMock.mockResolvedValue({ data: { session: null } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => expect(result.current.user?.id).toBe('owner-1'));

        await act(async () => authListener('INITIAL_SESSION', null));

        expect(result.current.user?.id).toBe('owner-1');
    });

    it('déconnecte bel et bien sur une vraie déconnexion', async () => {
        localStorage.setItem('sb-test-auth-token', JSON.stringify(STORED));
        getSessionMock.mockResolvedValue({ data: { session: null } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => expect(result.current.user?.id).toBe('owner-1'));

        await act(async () => authListener('SIGNED_OUT', null));

        expect(result.current.user).toBeNull();
    });

    it('reste déconnecté quand aucune session n\'est enregistrée', async () => {
        // supabase-js efface la session sur un jeton révoqué : rien à reprendre
        getSessionMock.mockResolvedValue({ data: { session: null } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        // le fournisseur n'affiche ses enfants qu'une fois la session résolue
        await waitFor(() => expect(result.current).not.toBeNull());

        expect(result.current.user).toBeNull();
    });
});
