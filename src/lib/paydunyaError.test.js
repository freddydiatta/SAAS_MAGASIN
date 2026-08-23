import { describe, it, expect } from 'vitest';
import { extractPaydunyaErrorMessage } from './paydunyaError';

describe('extractPaydunyaErrorMessage', () => {
    it('extracts the real error from the Edge Function response body', async () => {
        const error = {
            message: 'Edge Function returned a non-2xx status code',
            context: { json: async () => ({ error: 'Erreur PayDunya (1001): KYC requis' }) },
        };
        expect(await extractPaydunyaErrorMessage(error)).toBe('Erreur PayDunya (1001): KYC requis');
    });

    it('falls back to error.message when there is no context body', async () => {
        const error = { message: 'Network request failed' };
        expect(await extractPaydunyaErrorMessage(error)).toBe('Network request failed');
    });

    it('uses the generic fallback when nothing useful is available', async () => {
        const error = { message: 'Edge Function returned a non-2xx status code' };
        expect(await extractPaydunyaErrorMessage(error, 'Fallback message')).toBe('Fallback message');
    });
});
