import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheCashierCredentials, hasCachedCashier, verifyPinOffline, restoreSessionLocally, findCachedCashierByUserId } from './offlineCashierAuth';

const { getMock, setMock } = vi.hoisted(() => ({
    getMock: vi.fn(),
    setMock: vi.fn(),
}));

vi.mock('idb-keyval', () => ({
    get: getMock,
    set: setMock,
}));

// lib/supabase.js throws at import time without real env vars (by design,
// see its own file) — mocked here purely to provide a stable AUTH_STORAGE_KEY,
// same reasoning as SwitchUserModal.test.jsx.
vi.mock('../lib/supabase', () => ({
    AUTH_STORAGE_KEY: 'sb-test-project-auth-token',
}));

// Un vrai hash PBKDF2-SHA256 (100k itérations) de "1234" avec ce sel — même
// algorithme que verifyPin() côté Edge Function cashier-login — pour tester
// verifyPinOffline contre une valeur connue plutôt que la valeur qu'on
// vient tout juste de calculer nous-mêmes.
const SALT_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
let REAL_PIN_HASH;

async function derivePinHash(pin, saltHex) {
    const hexToBytes = (hex) => new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: 100_000 },
        keyMaterial,
        256
    );
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('offlineCashierAuth', () => {
    beforeEach(async () => {
        getMock.mockReset();
        setMock.mockReset();
        REAL_PIN_HASH = `${SALT_HEX}:${await derivePinHash('1234', SALT_HEX)}`;
    }, 20000);

    it('caches credentials keyed by member id, storing the full session as-is', async () => {
        getMock.mockResolvedValueOnce({});
        const session = { access_token: 'at', refresh_token: 'rt', expires_at: 9999999999, user: { id: 'u1' } };

        await cacheCashierCredentials('member-1', { name: 'Awa', pinHash: REAL_PIN_HASH, session });

        const [, stored] = setMock.mock.calls[0];
        expect(stored['member-1']).toMatchObject({
            name: 'Awa',
            pinHash: REAL_PIN_HASH,
            session,
            failedAttempts: 0,
            lockedUntil: null,
        });
    });

    it('hasCachedCashier reflects whether an entry exists', async () => {
        getMock.mockResolvedValueOnce({ 'member-1': { pinHash: REAL_PIN_HASH } });
        await expect(hasCachedCashier('member-1')).resolves.toBe(true);

        getMock.mockResolvedValueOnce({});
        await expect(hasCachedCashier('member-2')).resolves.toBe(false);
    });

    it('findCachedCashierByUserId matches by the auth session user id, not the member id', async () => {
        getMock.mockResolvedValueOnce({
            'member-1': { name: 'Awa', session: { user: { id: 'auth-user-a' } } },
            'member-2': { name: 'Kofi', session: { user: { id: 'auth-user-b' } } },
        });

        await expect(findCachedCashierByUserId('auth-user-b')).resolves.toEqual({ role: 'cashier', name: 'Kofi' });
    });

    it('findCachedCashierByUserId returns null when no cached cashier matches', async () => {
        getMock.mockResolvedValueOnce({
            'member-1': { name: 'Awa', session: { user: { id: 'auth-user-a' } } },
        });

        await expect(findCachedCashierByUserId('someone-else')).resolves.toBeNull();
    });

    it('reports not_cached when the member was never switched to online on this device', async () => {
        getMock.mockResolvedValueOnce({});
        const result = await verifyPinOffline('member-1', '1234');
        expect(result).toEqual({ success: false, reason: 'not_cached' });
    });

    it('succeeds with the correct PIN and returns the cached session', async () => {
        getMock.mockResolvedValueOnce({
            'member-1': { name: 'Awa', pinHash: REAL_PIN_HASH, session: { access_token: 'at', refresh_token: 'rt' }, failedAttempts: 0, lockedUntil: null },
        });

        const result = await verifyPinOffline('member-1', '1234');

        expect(result).toEqual({ success: true, name: 'Awa', session: { access_token: 'at', refresh_token: 'rt' } });
        // failed-attempt counter reset on success
        const [, stored] = setMock.mock.calls[0];
        expect(stored['member-1'].failedAttempts).toBe(0);
    }, 20000);

    it('still grants access on a correct PIN even if persisting the reset attempt counter fails', async () => {
        // The counter write is a best-effort bonus, not the access decision
        // (already made by the hash comparison) — a storage failure here
        // (quota, private browsing) must not turn a correct PIN into a denial.
        getMock.mockResolvedValueOnce({
            'member-1': { name: 'Awa', pinHash: REAL_PIN_HASH, session: { access_token: 'at' }, failedAttempts: 0, lockedUntil: null },
        });
        setMock.mockRejectedValueOnce(new Error('IndexedDB quota exceeded'));

        const result = await verifyPinOffline('member-1', '1234');

        expect(result).toEqual({ success: true, name: 'Awa', session: { access_token: 'at' } });
    }, 20000);

    it('rejects a wrong PIN and increments the failed-attempt counter', async () => {
        getMock.mockResolvedValueOnce({
            'member-1': { name: 'Awa', pinHash: REAL_PIN_HASH, session: {}, failedAttempts: 2, lockedUntil: null },
        });

        const result = await verifyPinOffline('member-1', '9999');

        expect(result).toEqual({ success: false, reason: 'wrong_pin' });
        const [, stored] = setMock.mock.calls[0];
        expect(stored['member-1'].failedAttempts).toBe(3);
        expect(stored['member-1'].lockedUntil).toBeNull();
    }, 20000);

    it('locks the account for 15 minutes after the 5th failed attempt, mirroring the server lockout', async () => {
        getMock.mockResolvedValueOnce({
            'member-1': { name: 'Awa', pinHash: REAL_PIN_HASH, session: {}, failedAttempts: 4, lockedUntil: null },
        });

        const result = await verifyPinOffline('member-1', 'wrong');

        expect(result).toEqual({ success: false, reason: 'wrong_pin' });
        const [, stored] = setMock.mock.calls[0];
        expect(stored['member-1'].failedAttempts).toBe(0);
        expect(new Date(stored['member-1'].lockedUntil).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    }, 20000);

    it('refuses even a correct PIN while locked out', async () => {
        getMock.mockResolvedValueOnce({
            'member-1': {
                name: 'Awa', pinHash: REAL_PIN_HASH, session: {}, failedAttempts: 0,
                lockedUntil: new Date(Date.now() + 60000).toISOString(),
            },
        });

        const result = await verifyPinOffline('member-1', '1234');

        expect(result).toEqual({ success: false, reason: 'locked' });
        expect(setMock).not.toHaveBeenCalled();
    });

    it('restoreSessionLocally writes the session directly under the storage key supabase-js reads, without any network call', () => {
        localStorage.clear();
        const session = { access_token: 'at', refresh_token: 'rt', expires_at: 9999999999, user: { id: 'u1' } };

        restoreSessionLocally(session);

        expect(JSON.parse(localStorage.getItem('sb-test-project-auth-token'))).toEqual(session);
    });
});
