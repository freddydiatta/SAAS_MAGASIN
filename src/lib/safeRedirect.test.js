import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeRedirect } from './safeRedirect';

describe('safeRedirect', () => {
    let originalLocation;

    beforeEach(() => {
        originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { href: '' },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation,
        });
    });

    it('navigates to a valid https URL', () => {
        safeRedirect('https://app.paydunya.com/checkout-invoice/abc123');

        expect(window.location.href).toBe('https://app.paydunya.com/checkout-invoice/abc123');
    });

    it('rejects a javascript: URL instead of navigating', () => {
        expect(() => safeRedirect('javascript:alert(1)')).toThrow('Lien de paiement invalide.');
        expect(window.location.href).toBe('');
    });

    it('rejects a data: URL', () => {
        expect(() => safeRedirect('data:text/html,<script>alert(1)</script>')).toThrow('Lien de paiement invalide.');
    });

    it('rejects a plain http (non-https) URL', () => {
        expect(() => safeRedirect('http://app.paydunya.com/checkout')).toThrow('Lien de paiement invalide.');
    });

    it('rejects a non-string value', () => {
        expect(() => safeRedirect(undefined)).toThrow('Lien de paiement invalide.');
    });
});
