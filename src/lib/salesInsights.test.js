import { describe, it, expect } from 'vitest';
import { computeSalesInsights } from './salesInsights';

// Instants UTC explicites : Dakar est à UTC+0, donc l'heure lue ici est celle
// du commerce quel que soit le fuseau de la machine qui lance les tests.
// Le 14 septembre 2026 est un lundi.
const NOW = new Date('2026-09-14T18:00:00Z');

const line = (overrides) => ({
    receipt_id: 'r1',
    product_id: 'p1',
    products: { name: 'FLAG GM' },
    quantity: 1,
    total_price: 1200,
    total_cost: 960,
    created_at: '2026-09-14T10:15:00Z',
    ...overrides,
});

describe('computeSalesInsights', () => {
    it('calcule le panier moyen par vente, pas par ligne', () => {
        // une vente de deux articles différents compte pour une seule vente
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'r1', product_id: 'p1', total_price: 1200 }),
                line({ receipt_id: 'r1', product_id: 'p2', products: { name: 'GOLD' }, total_price: 800 }),
                line({ receipt_id: 'r2', product_id: 'p1', total_price: 1000 }),
            ],
        });

        expect(insights.receiptsCount).toBe(2);
        expect(insights.revenue).toBe(3000);
        expect(insights.averageBasket).toBe(1500);
    });

    it('distingue ce qui se vend le plus de ce qui rapporte le plus', () => {
        // cas réel du dépôt : ROYAL DUTCH se vend davantage, GAZELLE rapporte
        // davantage. Les deux classements doivent le montrer.
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'a', product_id: 'royal', products: { name: 'ROYAL DUTCH' }, quantity: 11, total_price: 8800, total_cost: 7104 }),
                line({ receipt_id: 'b', product_id: 'gazelle', products: { name: 'GAZELLE GM' }, quantity: 8, total_price: 8000, total_cost: 5672 }),
            ],
        });

        expect(insights.topByQuantity[0].name).toBe('ROYAL DUTCH');
        expect(insights.topByMargin[0].name).toBe('GAZELLE GM');
        expect(insights.topByMargin[0].margin).toBe(2328);
    });

    it('relègue en fin de classement une marge inconnue, sans la compter à zéro', () => {
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'a', product_id: 'sanscout', products: { name: 'POMME PM' }, quantity: 20, total_price: 10000, total_cost: null }),
                line({ receipt_id: 'b', product_id: 'p1', quantity: 1, total_price: 1200, total_cost: 960 }),
            ],
        });

        expect(insights.topByMargin.map((p) => p.name)).toEqual(['FLAG GM', 'POMME PM']);
        expect(insights.topByMargin[1].marginKnown).toBe(false);
    });

    it('lit l\'heure de pointe dans l\'heure de Dakar', () => {
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'a', created_at: '2026-09-14T12:05:00Z' }),
                line({ receipt_id: 'b', created_at: '2026-09-14T12:40:00Z' }),
                line({ receipt_id: 'c', created_at: '2026-09-14T09:00:00Z' }),
            ],
        });

        expect(insights.peakHour).toMatchObject({ hour: 12, receipts: 2 });
    });

    it('garde toutes les heures de pointe quand elles font jeu égal', () => {
        // cas réel du dépôt : 6 ventes à 10h et 6 à 12h. N'en montrer qu'une
        // ferait croire à un pic unique.
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'a', created_at: '2026-09-14T10:05:00Z' }),
                line({ receipt_id: 'b', created_at: '2026-09-14T12:05:00Z' }),
            ],
        });

        expect(insights.peakHours.map((h) => h.hour)).toEqual([10, 12]);
    });

    it('compare les jours de la semaine en moyenne, pas en total', () => {
        // du lundi 7 au lundi 14, le lundi tombe deux fois et le dimanche une
        // seule : en total le lundi (6 000) paraîtrait meilleur que le
        // dimanche (5 000), alors qu'il vend moins par jour
        const insights = computeSalesInsights({
            now: NOW,
            period: 'all',
            sales: [
                // lundi 7 : première vente, et lundi 14 : deux petites journées
                line({ receipt_id: 'l1', created_at: '2026-09-07T10:00:00Z', total_price: 3000 }),
                line({ receipt_id: 'l2', created_at: '2026-09-14T10:00:00Z', total_price: 3000 }),
                // dimanche 13 : une seule grosse journée
                line({ receipt_id: 'd1', created_at: '2026-09-13T10:00:00Z', total_price: 5000 }),
            ],
        });

        const monday = insights.byWeekday[0];
        const sunday = insights.byWeekday[6];
        expect(monday.occurrences).toBe(2);
        expect(monday.averageRevenue).toBe(3000);
        expect(sunday.averageRevenue).toBe(5000);
        expect(insights.bestWeekday.label).toBe('Dimanche');
    });

    it('ne fait pas démarrer la période avant la première vente enregistrée', () => {
        // « 30 jours » sur un commerce suivi depuis 3 jours : diviser par 30
        // ferait croire que tout se vend dix fois moins vite
        const insights = computeSalesInsights({
            now: NOW,
            period: '30d',
            sales: [line({ created_at: '2026-09-12T10:00:00Z' })],
        });

        expect(insights.daysCovered).toBe(3);
    });

    it('annonce une rupture au rythme de vente observé', () => {
        // 12 vendus en 3 jours = 4 par jour ; il en reste 8 -> 2 jours
        const insights = computeSalesInsights({
            now: NOW,
            period: 'all',
            products: [
                { id: 'p1', name: 'FLAG GM', stock_quantity: 8, cost_price: 960 },
                { id: 'p2', name: 'GOLD', stock_quantity: 200, cost_price: 667 },
            ],
            sales: [
                line({ receipt_id: 'a', product_id: 'p1', quantity: 6, created_at: '2026-09-12T10:00:00Z' }),
                line({ receipt_id: 'b', product_id: 'p1', quantity: 6, created_at: '2026-09-14T10:00:00Z' }),
                line({ receipt_id: 'c', product_id: 'p2', quantity: 1, created_at: '2026-09-14T11:00:00Z' }),
            ],
        });

        expect(insights.runningOut).toHaveLength(1);
        expect(insights.runningOut[0]).toMatchObject({ name: 'FLAG GM', stock: 8 });
        expect(insights.runningOut[0].daysLeft).toBeCloseTo(2);
    });

    it('classe le stock qui dort par argent immobilisé', () => {
        const insights = computeSalesInsights({
            now: NOW,
            products: [
                { id: 'vendu', name: 'FLAG GM', stock_quantity: 10, cost_price: 960 },
                { id: 'petit', name: 'BARON', stock_quantity: 50, cost_price: 100 },
                { id: 'gros', name: 'RHUM PM', stock_quantity: 10, cost_price: 2000 },
                { id: 'vide', name: 'COCA', stock_quantity: 0, cost_price: 300 },
                { id: 'sanscout', name: 'POMME GM', stock_quantity: 4, cost_price: null },
            ],
            sales: [line({ product_id: 'vendu' })],
        });

        // un produit vendu ou épuisé ne dort pas ; le plus gros montant bloqué
        // passe devant, une valeur inconnue en dernier
        expect(insights.sleepingStock.map((p) => p.name)).toEqual(['RHUM PM', 'BARON', 'POMME GM']);
        expect(insights.sleepingValue).toBe(20000 + 5000);
    });

    it('repère les produits achetés ensemble, une fois l\'habitude répétée', () => {
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                // FLAG + GAZELLE dans deux ventes différentes : une habitude
                line({ receipt_id: 'a', product_id: 'flag', products: { name: 'FLAG GM' } }),
                line({ receipt_id: 'a', product_id: 'gaz', products: { name: 'GAZELLE GM' } }),
                line({ receipt_id: 'b', product_id: 'gaz', products: { name: 'GAZELLE GM' } }),
                line({ receipt_id: 'b', product_id: 'flag', products: { name: 'FLAG GM' } }),
                // GOLD + FLAG une seule fois : un hasard, pas une habitude
                line({ receipt_id: 'c', product_id: 'gold', products: { name: 'GOLD' } }),
                line({ receipt_id: 'c', product_id: 'flag', products: { name: 'FLAG GM' } }),
            ],
        });

        expect(insights.boughtTogether).toHaveLength(1);
        expect(insights.boughtTogether[0].times).toBe(2);
        expect([...insights.boughtTogether[0].names].sort()).toEqual(['FLAG GM', 'GAZELLE GM']);
        expect(insights.multiItemSales).toBe(3);
    });

    it('ne compte pas deux fois une paire quand un produit figure sur deux lignes', () => {
        // le même produit scanné deux fois dans la même vente reste une paire
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'a', product_id: 'flag' }),
                line({ receipt_id: 'a', product_id: 'flag' }),
                line({ receipt_id: 'a', product_id: 'gaz', products: { name: 'GAZELLE GM' } }),
                line({ receipt_id: 'b', product_id: 'flag' }),
                line({ receipt_id: 'b', product_id: 'gaz', products: { name: 'GAZELLE GM' } }),
            ],
        });

        expect(insights.boughtTogether[0].times).toBe(2);
    });

    it('dit comment les clients paient, et le panier moyen de chaque moyen', () => {
        const insights = computeSalesInsights({
            now: NOW,
            sales: [
                line({ receipt_id: 'a', total_price: 1000, receipts: { payment_method: 'cash' } }),
                line({ receipt_id: 'b', total_price: 2000, receipts: { payment_method: 'cash' } }),
                line({ receipt_id: 'c', total_price: 6000, receipts: { payment_method: 'mobile_money' } }),
            ],
        });

        expect(insights.paymentMix).toEqual([
            expect.objectContaining({ label: 'Espèces', receipts: 2, averageBasket: 1500 }),
            expect.objectContaining({ label: 'Mobile Money', receipts: 1, averageBasket: 6000 }),
        ]);
        expect(insights.paymentMix[0].share).toBeCloseTo(2 / 3);
    });

    it('reste sobre quand il n\'y a encore aucune vente', () => {
        const insights = computeSalesInsights({ now: NOW, sales: [], products: [] });

        expect(insights.receiptsCount).toBe(0);
        expect(insights.averageBasket).toBe(0);
        expect(insights.peakHour).toBeNull();
        expect(insights.bestWeekday).toBeNull();
    });
});
