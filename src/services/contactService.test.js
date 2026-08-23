import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitContactMessage } from './contactService';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { functions: { invoke: invokeMock } },
}));

describe('submitContactMessage', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('invokes the Edge Function with the expected payload shape', async () => {
        invokeMock.mockResolvedValueOnce({ data: { success: true }, error: null });

        await submitContactMessage({ name: 'Awa', contactInfo: '771234567', message: 'Bonjour' });

        expect(invokeMock).toHaveBeenCalledWith('send-contact-message', {
            body: { name: 'Awa', contact_info: '771234567', message: 'Bonjour' },
        });
    });

    it('throws on a transport-level error', async () => {
        invokeMock.mockResolvedValueOnce({ data: null, error: new Error('Load failed') });

        await expect(submitContactMessage({ name: 'Awa', contactInfo: '771234567', message: 'Bonjour' }))
            .rejects.toThrow('Load failed');
    });

    it('throws on an application-level error returned in the response body', async () => {
        invokeMock.mockResolvedValueOnce({ data: { error: 'Merci de remplir tous les champs.' }, error: null });

        await expect(submitContactMessage({ name: '', contactInfo: '', message: '' }))
            .rejects.toThrow('Merci de remplir tous les champs.');
    });
});
