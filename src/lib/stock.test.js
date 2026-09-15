import { describe, it, expect } from 'vitest';
import { needsRestock, isOutOfStock, byRestockUrgency, LOW_STOCK_THRESHOLD } from './stock';

describe('stock', () => {
    it('garde le même seuil que la notification envoyée par la base', () => {
        // process_sale (supabase/setup.sql) alerte à 5 unités : la carte de
        // l'aperçu et la liste filtrée doivent parler des mêmes produits
        expect(LOW_STOCK_THRESHOLD).toBe(5);
        expect(needsRestock({ stock_quantity: 5 })).toBe(true);
        expect(needsRestock({ stock_quantity: 6 })).toBe(false);
    });

    it('distingue une rupture d\'un stock simplement bas', () => {
        expect(isOutOfStock({ stock_quantity: 0 })).toBe(true);
        expect(isOutOfStock({ stock_quantity: 1 })).toBe(false);
    });

    it('classe les ruptures en tête, puis du plus vide au moins vide', () => {
        const products = [
            { name: 'GOLD', stock_quantity: 4 },
            { name: 'ROYAL DUTCH', stock_quantity: 0 },
            { name: 'ANANAS PM', stock_quantity: 2 },
            { name: 'FLAG GM', stock_quantity: 0 },
        ];

        expect([...products].sort(byRestockUrgency).map((p) => p.name))
            .toEqual(['FLAG GM', 'ROYAL DUTCH', 'ANANAS PM', 'GOLD']);
    });
});
