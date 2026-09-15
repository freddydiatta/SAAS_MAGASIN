import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useRetailDashboardStats } from './useRetailDashboardStats';
import { renderHookWithQueryClient } from '../test/testUtils';
import { startOfDay } from '../lib/dates';

function createQueryBuilder(result) {
    const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
    supabase: { from: fromMock },
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'u1', email: 'owner@test.com' } }),
}));

const BUSINESS = { id: 'biz-1' };
const PRODUCTS = [
    { id: 'p1', name: 'Casque Moto', stock_quantity: 1 }, // sous le seuil de 5 -> stock bas
    { id: 'p2', name: 'Pneu', stock_quantity: 10 },
];

// Instant fixe, passé au hook : la comparaison avec « hier à la même heure »
// dépend de l'heure qu'il est. Avec l'horloge réelle, un test lancé à 8h ne
// verrait pas la vente d'hier 9h, et le même test passerait ou échouerait
// selon le moment de la journée. Journées lues en heure de Dakar (lib/dates).
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = startOfDay(Date.UTC(2026, 8, 15, 12)) + 12 * 60 * 60 * 1000; // 15 sept., midi
const OPTIONS = { now: NOW };
const today9am = new Date(startOfDay(NOW) + 9 * 60 * 60 * 1000);
const yesterday9am = new Date(today9am.getTime() - DAY_MS);

const SALES = [
    { id: 's1', quantity: 2, total_price: 2000, created_at: today9am.toISOString(), products: { name: 'Casque Moto', type: 'moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
    { id: 's2', quantity: 1, total_price: 1000, created_at: today9am.toISOString(), products: { name: 'Pneu', type: 'moto' }, receipts: { status: 'completed', payment_method: 'mobile_money' } },
    { id: 's3', quantity: 1, total_price: 500, created_at: yesterday9am.toISOString(), products: { name: 'Casque Moto', type: 'moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
];

const SALES_WITH_CREDIT = [
    ...SALES,
    { id: 's4', quantity: 1, total_price: 4000, created_at: today9am.toISOString(), products: { name: 'Casque Moto', type: 'moto' }, receipts: { status: 'completed', payment_method: 'credit' } },
];

describe('useRetailDashboardStats', () => {
    beforeEach(() => {
        fromMock.mockReset();
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            if (table === 'purchase_orders') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
    });

    it('computes today vs yesterday totals, percent change, average basket and stock alerts', async () => {
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));

        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // today: 2000 (cash) + 1000 (mobile) = 3000 ; yesterday by noon: 500
        expect(result.current.caisseDuJour).toBe(3000);
        expect(result.current.caisseDuJourCash).toBe(2000);
        expect(result.current.caisseDuJourMobile).toBe(1000);
        expect(result.current.caisseHier).toBe(500);
        expect(result.current.transactions).toBe(2);
        expect(result.current.transactionsHier).toBe(1);
        expect(result.current.panierMoyen).toBe(1500); // 3000 / 2
        expect(result.current.alertesStock).toBe(1);
        expect(result.current.lowStockProducts).toEqual([{ id: 'p1', name: 'Casque Moto', stock_quantity: 1 }]);
    });

    it('compares with yesterday up to the same time, never with the whole of yesterday', async () => {
        // à midi, la vente d'hier à 15h n'a pas encore « eu lieu » : la compter
        // ferait paraître la matinée en retard sur une journée entière
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({
                data: [
                    ...SALES,
                    { id: 's9', quantity: 1, total_price: 9000, created_at: new Date(yesterday9am.getTime() + 6 * 60 * 60 * 1000).toISOString(), products: { name: 'Pneu', type: 'moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
                ],
                error: null,
            });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.caisseHier).toBe(500);
        expect(result.current.transactionsHier).toBe(1);
    });

    it('sorts the products to restock by urgency and counts the ones already out of stock', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({
                data: [
                    { id: 'p1', name: 'Presque vide', stock_quantity: 3 },
                    { id: 'p2', name: 'Rupture', stock_quantity: 0 },
                    { id: 'p3', name: 'Sain', stock_quantity: 40 },
                ],
                error: null,
            });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // la carte de l'aperçu montre les ruptures d'abord : ce sont elles
        // qui font perdre des ventes aujourd'hui
        expect(result.current.lowStockProducts.map((p) => p.name)).toEqual(['Rupture', 'Presque vide']);
        expect(result.current.outOfStockCount).toBe(1);
    });

    it('flags a product as low stock up to 5 units, the same threshold that fires the push alert', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({
                data: [
                    { id: 'p1', name: 'Juste au seuil', stock_quantity: 5 },
                    { id: 'p2', name: 'Sous le seuil', stock_quantity: 4 },
                    { id: 'p3', name: 'Au-dessus', stock_quantity: 6 },
                ],
                error: null,
            });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // le seuil est inclusif : 5 alerte, 6 non (et le plus vide passe devant)
        expect(result.current.lowStockProducts.map((p) => p.name)).toEqual(['Sous le seuil', 'Juste au seuil']);
        expect(result.current.alertesStock).toBe(2);
    });

    it('produces a 7-day chart series and top products ranked by quantity sold', async () => {
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.chartData).toHaveLength(7);
        expect(result.current.topProducts[0]).toMatchObject({ name: 'Casque Moto', quantity: 3, revenue: 2500 });
    });

    it('excludes credit sales from caisse du jour and the average basket, but still counts them as a transaction', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            if (table === 'purchase_orders') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES_WITH_CREDIT, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // Same collected total as before (3000) — the 4000 credit sale is not
        // money actually in hand yet.
        expect(result.current.caisseDuJour).toBe(3000);
        expect(result.current.caisseDuJourCredit).toBe(4000);
        // panier moyen only averages the two collected sales, not the credit one
        expect(result.current.panierMoyen).toBe(1500);
        // but the credit sale still happened — it counts as a transaction
        expect(result.current.transactions).toBe(3);
    });

    it('excludes credit sales from the 7-day chart total and per-product revenue, but keeps their quantity', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: [], error: null });
            if (table === 'purchase_orders') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES_WITH_CREDIT, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        const todayEntry = result.current.chartData[result.current.chartData.length - 1];
        expect(todayEntry.total).toBe(3000);

        const casque = result.current.topProducts.find((p) => p.name === 'Casque Moto');
        // quantity: 2 (cash) + 1 (yesterday cash) + 1 (credit) = 4 units actually sold
        expect(casque.quantity).toBe(4);
        // revenue: only the cash sales (2000 + 500), not the 4000 credit sale
        expect(casque.revenue).toBe(2500);
    });

    it('counts a debt repaid today as cash collected, without treating it as a basket', async () => {
        const DEBTS = [
            {
                id: 'd1', customer_name: 'Moussa', amount: 4000, status: 'paid', paid_at: today9am.toISOString(),
                payments: [{ id: 'dp1', amount: 4000, payment_method: null, paid_at: today9am.toISOString() }],
            },
            { id: 'd2', customer_name: 'Awa', amount: 1000, status: 'unpaid', payments: [] },
        ];
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: DEBTS, error: null });
            if (table === 'purchase_orders') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // 3000 in sales + the 4000 debt repaid today
        expect(result.current.caisseDuJour).toBe(7000);
        expect(result.current.caisseDuJourRembourse).toBe(4000);
        // no payment method recorded on that repayment -> shown on its own line
        // rather than assumed to be cash sitting in the drawer
        expect(result.current.caisseDuJourMoyenInconnu).toBe(4000);
        expect(result.current.caisseDuJourCash).toBe(2000);
        // still only 2 actual sales today -> unaffected average basket
        expect(result.current.panierMoyen).toBe(1500);
    });

    it('adds a repayment to the method it was actually paid with, without double counting', async () => {
        const DEBTS = [
            {
                id: 'd1', customer_name: 'Moussa', amount: 4000, status: 'paid', paid_at: today9am.toISOString(), payment_method: 'cash',
                payments: [{ id: 'dp1', amount: 4000, payment_method: 'cash', paid_at: today9am.toISOString() }],
            },
            {
                id: 'd2', customer_name: 'Awa', amount: 1500, status: 'paid', paid_at: today9am.toISOString(), payment_method: 'mobile_money',
                payments: [{ id: 'dp2', amount: 1500, payment_method: 'mobile_money', paid_at: today9am.toISOString() }],
            },
        ];
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: DEBTS, error: null });
            if (table === 'purchase_orders') return createQueryBuilder({ data: [], error: null });
            return createQueryBuilder({ data: SALES, error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        // 2000 de ventes en espèces + 4000 remboursés en espèces
        expect(result.current.caisseDuJourCash).toBe(6000);
        // 1000 de ventes mobile + 1500 remboursés en mobile
        expect(result.current.caisseDuJourMobile).toBe(2500);
        // rien d'inconnu : la ligne séparée disparaît, donc pas de double compte
        expect(result.current.caisseDuJourMoyenInconnu).toBe(0);
        expect(result.current.caisseDuJourCash + result.current.caisseDuJourMobile).toBe(result.current.caisseDuJour);
    });

    it('counts only the instalment received today, not the whole debt it settles', async () => {
        // un client soldait aujourd'hui une dette de 10 000 sur laquelle il avait
        // déjà versé 6 000 la veille : seuls les 4 000 d'aujourd'hui sont entrés
        // dans la caisse du jour, et l'avance d'hier compte pour hier
        const DEBTS = [{
            id: 'd1', customer_name: 'Moussa', amount: 10000, status: 'paid', paid_at: today9am.toISOString(),
            payments: [
                { id: 'dp1', amount: 6000, payment_method: 'cash', paid_at: yesterday9am.toISOString() },
                { id: 'dp2', amount: 4000, payment_method: 'cash', paid_at: today9am.toISOString() },
            ],
        }];
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: DEBTS, error: null });
            return createQueryBuilder({ data: [], error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.caisseDuJour).toBe(4000);
        expect(result.current.caisseDuJourCash).toBe(4000);
        expect(result.current.caisseHier).toBe(6000);
    });

    it('counts an advance on a debt that is not settled yet', async () => {
        // avant, seule une dette entièrement remboursée entrait en caisse : une
        // avance de 5 000 reçue ce matin n'apparaissait nulle part
        const DEBTS = [{
            id: 'd1', customer_name: 'Awa', amount: 10000, status: 'unpaid',
            payments: [{ id: 'dp1', amount: 5000, payment_method: 'mobile_money', paid_at: today9am.toISOString() }],
        }];
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            if (table === 'debts') return createQueryBuilder({ data: DEBTS, error: null });
            return createQueryBuilder({ data: [], error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.caisseDuJour).toBe(5000);
        expect(result.current.caisseDuJourMobile).toBe(5000);
    });

    it('reports nothing for yesterday (not a divide-by-zero) when neither day has sold', async () => {
        fromMock.mockImplementation((table) => {
            if (table === 'products') return createQueryBuilder({ data: PRODUCTS, error: null });
            return createQueryBuilder({ data: [], error: null });
        });
        const { result } = renderHookWithQueryClient(() => useRetailDashboardStats(BUSINESS, OPTIONS));
        await waitFor(() => expect(result.current.loadingSales).toBe(false));

        expect(result.current.caisseHier).toBe(0);
        expect(result.current.panierMoyen).toBe(0);
    });
});
