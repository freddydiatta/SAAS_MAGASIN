import { describe, it, expect } from 'vitest';
import { isNetworkError } from './networkError';

describe('isNetworkError', () => {
    it('reconnaît un échec réseau quel que soit le navigateur', () => {
        // forme renvoyée par supabase-js quand fetch échoue
        expect(isNetworkError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true);
        expect(isNetworkError({ message: 'TypeError: Load failed', code: '' })).toBe(true); // Safari iPhone
        expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    });

    it('reconnaît l\'échec du renouvellement de connexion sans réseau', () => {
        const error = new Error('Failed to fetch');
        error.name = 'AuthRetryableFetchError';
        expect(isNetworkError(error)).toBe(true);
    });

    it('ne prend pas un refus du serveur pour une coupure', () => {
        expect(isNetworkError({ message: 'Stock insuffisant pour "BABOK PM": disponible 2, demandé 3', code: 'P0001' })).toBe(false);
        expect(isNetworkError({ message: 'duplicate key value violates unique constraint', code: '23505' })).toBe(false);
        expect(isNetworkError(null)).toBe(false);
    });
});
