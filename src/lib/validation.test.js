import { describe, it, expect } from 'vitest';
import { businessSchema, restaurantOrderSchema, villaSchema, productSchema, supplierSchema, debtSchema, firstZodError } from './validation';

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

describe('villaSchema', () => {
    it('passes image_url through when set', () => {
        const result = villaSchema.safeParse({
            name: 'Villa Saly', address: '', price_per_night: 100000, image_url: 'https://x/villa.jpg',
        });
        expect(result.success).toBe(true);
        expect(result.data.image_url).toBe('https://x/villa.jpg');
    });

    it('accepts a villa with no photo yet', () => {
        const result = villaSchema.safeParse({ name: 'Villa Saly', address: '', price_per_night: 100000, image_url: '' });
        expect(result.success).toBe(true);
        expect(result.data.image_url).toBe('');
    });
});

describe('productSchema', () => {
    it('accepts a product with no cost price (leaves it undefined)', () => {
        const result = productSchema.safeParse({ name: 'Casque', price: 5000, quantity: 10, costPrice: '' });
        expect(result.success).toBe(true);
        expect(result.data.costPrice).toBeUndefined();
    });

    it('coerces a valid cost price to a number', () => {
        const result = productSchema.safeParse({ name: 'Casque', price: 5000, quantity: 10, costPrice: '3000' });
        expect(result.success).toBe(true);
        expect(result.data.costPrice).toBe(3000);
    });

    it('rejects a negative cost price', () => {
        const result = productSchema.safeParse({ name: 'Casque', price: 5000, quantity: 10, costPrice: -100 });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/prix d'achat ne peut pas être négatif/);
    });
});

describe('supplierSchema', () => {
    it('accepts a supplier with only a name', () => {
        const result = supplierSchema.safeParse({ name: 'Import Moto', contactName: '', phone: '', email: '' });
        expect(result.success).toBe(true);
    });

    it('rejects a blank name', () => {
        const result = supplierSchema.safeParse({ name: '   ' });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/nom du fournisseur est requis/);
    });

    it('rejects an invalid email', () => {
        const result = supplierSchema.safeParse({ name: 'Import Moto', email: 'not-an-email' });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/email invalide/);
    });
});

describe('debtSchema', () => {
    it('accepts a debt with only a name and an amount', () => {
        const result = debtSchema.safeParse({ customerName: 'Moussa Diop', customerPhone: '', amount: 5000, note: '' });
        expect(result.success).toBe(true);
    });

    it('rejects a blank customer name', () => {
        const result = debtSchema.safeParse({ customerName: '   ', amount: 1000 });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/nom du client est requis/);
    });

    it('rejects a zero or negative amount', () => {
        const result = debtSchema.safeParse({ customerName: 'Moussa Diop', amount: 0 });
        expect(result.success).toBe(false);
        expect(firstZodError(result)).toMatch(/montant doit être supérieur à 0/);
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
