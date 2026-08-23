import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { BusinessProvider, useBusiness } from './BusinessContext';

const { useAuthMock, refreshSessionMock } = vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    refreshSessionMock: vi.fn(),
}));

vi.mock('./AuthContext', () => ({
    useAuth: useAuthMock,
}));

const { getSessionMock, signInWithPasswordMock, signOutMock, rpcMock, fromMock } = vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    signInWithPasswordMock: vi.fn(),
    signOutMock: vi.fn(),
    rpcMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: { getSession: getSessionMock, signInWithPassword: signInWithPasswordMock, signOut: signOutMock },
        rpc: rpcMock,
        from: fromMock,
    },
}));

const { verifyPinOfflineMock, restoreSessionLocallyMock, cacheCashierCredentialsMock, findCachedCashierByUserIdMock } = vi.hoisted(() => ({
    verifyPinOfflineMock: vi.fn(),
    restoreSessionLocallyMock: vi.fn(),
    cacheCashierCredentialsMock: vi.fn(),
    findCachedCashierByUserIdMock: vi.fn(),
}));

vi.mock('../services/offlineCashierAuth', () => ({
    verifyPinOffline: verifyPinOfflineMock,
    restoreSessionLocally: restoreSessionLocallyMock,
    cacheCashierCredentials: cacheCashierCredentialsMock,
    findCachedCashierByUserId: findCachedCashierByUserIdMock,
}));

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve(result)),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const wrapper = ({ children }) => <BusinessProvider>{children}</BusinessProvider>;

describe('BusinessContext', () => {
    beforeEach(() => {
        useAuthMock.mockReset();
        getSessionMock.mockReset();
        signInWithPasswordMock.mockReset();
        signOutMock.mockReset();
        rpcMock.mockReset();
        fromMock.mockReset();
        verifyPinOfflineMock.mockReset();
        restoreSessionLocallyMock.mockReset();
        cacheCashierCredentialsMock.mockReset();
        findCachedCashierByUserIdMock.mockReset();
        refreshSessionMock.mockReset();

        useAuthMock.mockReturnValue({ user: { id: 'owner-1' }, refreshSession: refreshSessionMock });
        getSessionMock.mockResolvedValue({ data: { session: null } });
        fromMock.mockImplementation(() => createQueryBuilder({ data: [], error: null }));
    });

    describe('switchToCashierOffline', () => {
        it('restores the cached session directly (no setSession, no network) when the PIN is correct and not expired', async () => {
            const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
            verifyPinOfflineMock.mockResolvedValueOnce({
                success: true, name: 'Awa', session: { access_token: 'at', refresh_token: 'rt', expires_at: futureExpiry },
            });

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.switchToCashierOffline('member-1', '1234');
            });

            expect(restoreSessionLocallyMock).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt', expires_at: futureExpiry });
            expect(refreshSessionMock).toHaveBeenCalled();
            expect(signInWithPasswordMock).not.toHaveBeenCalled();
        });

        it('rejects with a clear message instead of restoring a session that has actually expired', async () => {
            const pastExpiry = Math.floor(Date.now() / 1000) - 10;
            verifyPinOfflineMock.mockResolvedValueOnce({
                success: true, name: 'Awa', session: { access_token: 'at', refresh_token: 'rt', expires_at: pastExpiry },
            });

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await expect(result.current.switchToCashierOffline('member-1', '1234'))
                .rejects.toThrow(/session mise en cache pour ce caissier a expiré/);

            expect(restoreSessionLocallyMock).not.toHaveBeenCalled();
            expect(refreshSessionMock).not.toHaveBeenCalled();
        });

        it('surfaces a specific error when this cashier was never used online on this device', async () => {
            verifyPinOfflineMock.mockResolvedValueOnce({ success: false, reason: 'not_cached' });

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await expect(result.current.switchToCashierOffline('member-1', '1234'))
                .rejects.toThrow(/jamais été utilisé sur cet appareil/);
        });

        it('surfaces the local lockout message', async () => {
            verifyPinOfflineMock.mockResolvedValueOnce({ success: false, reason: 'locked' });

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await expect(result.current.switchToCashierOffline('member-1', '0000'))
                .rejects.toThrow(/Trop de tentatives/);
        });
    });

    describe('switchToCashier (online)', () => {
        it("doesn't fail the switch when caching the session for offline use throws", async () => {
            signInWithPasswordMock.mockResolvedValueOnce({ data: { session: { access_token: 'at' } }, error: null });
            cacheCashierCredentialsMock.mockRejectedValueOnce(new Error('IndexedDB quota exceeded'));

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            // Must resolve, not reject: the sign-in itself already succeeded.
            await expect(result.current.switchToCashier({
                email: 'awa@cashier.local', password: 'secret', memberId: 'member-1', name: 'Awa', pinHash: 'salt:hash',
            })).resolves.toBeUndefined();
        });
    });

    describe('resolveMembership offline fallback', () => {
        it('falls back to the local cashier cache (by auth user id) when the live membership query fails, e.g. offline', async () => {
            const BUSINESS = { id: 'biz-1', user_id: 'someone-else', name: 'Boutique' };
            fromMock.mockImplementation((table) => {
                if (table === 'businesses') return createQueryBuilder({ data: [BUSINESS], error: null });
                if (table === 'business_members_safe') return createQueryBuilder({ data: null, error: new Error('Load failed') });
                return createQueryBuilder({ data: null, error: null });
            });
            useAuthMock.mockReturnValue({ user: { id: 'cashier-1' }, refreshSession: refreshSessionMock });
            findCachedCashierByUserIdMock.mockResolvedValueOnce({ role: 'cashier', name: 'Awa' });

            const { result } = renderHook(() => useBusiness(), { wrapper });

            // memberResolved flips true twice here — once for the initial
            // render (no selectedBusiness yet), again once the real
            // resolution (network failure -> cache fallback) completes —
            // so wait on the actual end state, not just the flag.
            await waitFor(() => expect(result.current.currentMember).toEqual({ role: 'cashier', name: 'Awa' }));
            expect(result.current.memberResolved).toBe(true);
            expect(result.current.isCashier).toBe(true);
            expect(findCachedCashierByUserIdMock).toHaveBeenCalledWith('cashier-1');
        });

        it('resolves to no membership (not stuck loading) when the query fails and nothing is cached for this user either', async () => {
            const BUSINESS = { id: 'biz-1', user_id: 'someone-else', name: 'Boutique' };
            fromMock.mockImplementation((table) => {
                if (table === 'businesses') return createQueryBuilder({ data: [BUSINESS], error: null });
                if (table === 'business_members_safe') return createQueryBuilder({ data: null, error: new Error('Load failed') });
                return createQueryBuilder({ data: null, error: null });
            });
            useAuthMock.mockReturnValue({ user: { id: 'stranger-1' }, refreshSession: refreshSessionMock });
            findCachedCashierByUserIdMock.mockResolvedValueOnce(null);

            const { result } = renderHook(() => useBusiness(), { wrapper });

            // `null` is also the transient value before selectedBusiness loads,
            // so wait for the fallback lookup itself before asserting the end state.
            await waitFor(() => expect(findCachedCashierByUserIdMock).toHaveBeenCalledWith('stranger-1'));
            await waitFor(() => expect(result.current.memberResolved).toBe(true));
            expect(result.current.currentMember).toBeNull();
        });
    });

    describe('switchBackToOwner', () => {
        beforeEach(() => {
            sessionStorage.setItem('gestionpro_owner_session', 'owner@test.com');
        });

        it('propagates the real sign-in error even when the failed-login audit log call itself fails', async () => {
            const realError = new Error('Invalid login credentials');
            signInWithPasswordMock.mockResolvedValueOnce({ data: {}, error: realError });
            rpcMock.mockImplementation(() => ({ then: (_onFulfilled, onRejected) => onRejected?.(new Error('offline')) }));

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await expect(result.current.switchBackToOwner('wrong-password')).rejects.toBe(realError);
        });

        it('succeeds even when the success audit log call fails', async () => {
            signInWithPasswordMock.mockResolvedValueOnce({ data: {}, error: null });
            rpcMock.mockImplementation(() => ({ then: (_onFulfilled, onRejected) => onRejected?.(new Error('offline')) }));

            const { result } = renderHook(() => useBusiness(), { wrapper });
            await waitFor(() => expect(result.current.loading).toBe(false));

            await expect(result.current.switchBackToOwner('correct-password')).resolves.toBeUndefined();
        });
    });
});
