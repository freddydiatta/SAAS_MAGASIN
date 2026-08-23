import { get, set } from 'idb-keyval';
import { AUTH_STORAGE_KEY } from '../lib/supabase';

const STORE_KEY = 'offline_cashier_auth';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // même durée que record_pin_attempt côté serveur

const readStore = async () => (await get(STORE_KEY)) || {};
const writeStore = async (store) => set(STORE_KEY, store);

const hexToBytes = (hex) => new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
const bytesToHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

// Même algorithme que verifyPin() côté Edge Function cashier-login
// (PBKDF2-SHA256, 100 000 itérations) : nécessaire pour que le hash mis en
// cache après une bascule en ligne reste vérifiable localement.
const derivePinHash = async (pin, saltHex) => {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: 100_000 },
        keyMaterial,
        256
    );
    return bytesToHex(new Uint8Array(bits));
};

/**
 * À appeler après une bascule vers un caissier réussie EN LIGNE : met en
 * cache son pin_hash (déjà salé côté serveur) et la session complète
 * obtenue (access_token, refresh_token, expires_at, user...), pour que ce
 * même caissier reste sélectionnable hors-ligne sur cet appareil. La
 * session est gardée telle quelle (pas juste access/refresh_token) car
 * restoreSessionLocally() doit reproduire exactement ce que supabase-js
 * range normalement en storage — il lui faut expires_at pour ne pas être
 * rejetée par sa propre validation.
 */
export const cacheCashierCredentials = async (memberId, { name, pinHash, session }) => {
    const store = await readStore();
    store[memberId] = {
        name,
        pinHash,
        session,
        failedAttempts: 0,
        lockedUntil: null,
        cachedAt: new Date().toISOString(),
    };
    await writeStore(store);
};

export const hasCachedCashier = async (memberId) => {
    const store = await readStore();
    return !!store[memberId];
};

/**
 * Restaure une session en écrivant directement dans le storage lu par
 * supabase-js, plutôt que via supabase.auth.setSession() — qui déclenche
 * toujours un appel réseau (voir le commentaire sur AUTH_STORAGE_KEY dans
 * lib/supabase.js) et échoue donc systématiquement hors-ligne. Le prochain
 * appel à supabase.auth.getSession() lira cette session directement depuis
 * le storage sans réseau, tant que son expires_at n'est pas dépassé.
 */
export const restoreSessionLocally = (session) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

/**
 * Vérifie le PIN localement quand cashier-login est inatteignable (hors
 * ligne). Un verrou local (5 tentatives -> 15 min, mêmes seuils que le
 * serveur) limite le brute-force, même s'il reste moins fiable qu'une
 * vérification serveur : quelqu'un avec accès à l'appareil pourrait vider
 * IndexedDB pour le réinitialiser. C'est le compromis accepté pour permettre
 * ce changement d'utilisateur sans réseau — le retour au compte
 * propriétaire, plus sensible, continue lui d'exiger une reconnexion réelle.
 */
export const verifyPinOffline = async (memberId, pin) => {
    const store = await readStore();
    const entry = store[memberId];
    if (!entry) {
        return { success: false, reason: 'not_cached' };
    }

    if (entry.lockedUntil && new Date(entry.lockedUntil) > new Date()) {
        return { success: false, reason: 'locked' };
    }

    const [saltHex] = entry.pinHash.split(':');
    const computedHash = `${saltHex}:${await derivePinHash(pin, saltHex)}`;

    if (computedHash === entry.pinHash) {
        entry.failedAttempts = 0;
        entry.lockedUntil = null;
        await writeStore(store);
        return { success: true, name: entry.name, session: entry.session };
    }

    entry.failedAttempts = (entry.failedAttempts || 0) + 1;
    if (entry.failedAttempts >= MAX_ATTEMPTS) {
        entry.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
        entry.failedAttempts = 0;
    }
    await writeStore(store);

    return { success: false, reason: 'wrong_pin' };
};
