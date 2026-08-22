import { describe, it, expect } from 'vitest';
import { businessSchema, restaurantOrderSchema, firstZodError } from './validation';

describe('businessSchema', () => {
    it('accepts a valid business with optional fields left blank', () => {
        const result = businessSchema.safeParse({ name: 'Ma Boutique', type: 'boutique', phone: '', address: '' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ name: 'Ma Boutique', type: 'boutique', phone: '', address: '' });
    });

    it('trims the name and rejects a blank one', () => {
        const blank = businessSchema.safeParse({ name: '   ', type: 'boutique' });
        expect(blank.success).toBe(false);
        expect(firstZodError(blank)).toMatch(/nom de l'entreprise est requis/);

        const trimmed = businessSchema.safeParse({ name: '  Ma Boutique  ', type: 'boutique' });
        expect(trimmed.success).toBe(true);
        expect(trimmed.data.name).toBe('Ma Boutique');
    });

    it('rejects a phone number with letters', () => {
        const result = businessSchema.safeParse({ name: 'Ma Boutique', type: 'boutique', phone: 'abc123' });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/téléphone invalide/);
    });

    it('rejects a missing type', () => {
        const result = businessSchema.safeParse({ name: 'Ma Boutique', type: '' });
        expect(result.success).toBe(false);
    });
});

describe('restaurantOrderSchema', () => {
    it('accepts an empty table number (takeaway order)', () => {
        const result = restaurantOrderSchema.safeParse({ tableNumber: '' });
        expect(result.success).toBe(true);
        expect(result.data.tableNumber).toBe('');
    });

    it('trims the table number', () => {
        const result = restaurantOrderSchema.safeParse({ tableNumber: '  Table 4  ' });
        expect(result.success).toBe(true);
        expect(result.data.tableNumber).toBe('Table 4');
    });

    it('rejects a table number longer than 50 characters', () => {
        const result = restaurantOrderSchema.safeParse({ tableNumber: 'x'.repeat(51) });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/trop long/);
    });
});
