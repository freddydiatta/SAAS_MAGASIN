import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useFinances } from './useFinances';
import { renderHookWithQueryClient } from '../test/testUtils';
import { zonedYearMonth } from '../lib/dates';

const { fetchAllSalesMock, fetchExpensesMock, fetchDebtsMock, fetchPurchaseOrdersMock } = vi.hoisted(() => ({
    fetchAllSalesMock: vi.fn(),
    fetchExpensesMock: vi.fn(),
    fetchDebtsMock: vi.fn(),
    fetchPurchaseOrdersMock: vi.fn(),
}));

vi.mock('../services/financesService', () => ({
    fetchAllSales: fetchAllSalesMock,
}));

vi.mock('../services/expensesService', () => ({
    fetchExpenses: fetchExpensesMock,
}));

vi.mock('../services/debtsService', () => ({
    fetchDebts: fetchDebtsMock,
}));

vi.mock('../services/purchaseOrdersService', () => ({
    fetchPurchaseOrders: fetchPurchaseOrdersMock,
}));

const { fetchMoneyAccountsMock } = vi.hoisted(() => ({ fetchMoneyAccountsMock: vi.fn() }));

vi.mock('../services/moneyAccountsService', () => ({
    fetchMoneyAccounts: fetchMoneyAccountsMock,
    addMoneyAccount: vi.fn(),
    updateMoneyAccount: vi.fn(),
    deleteMoneyAccount: vi.fn(),
}));

const { useProductsMock } = vi.hoisted(() => ({ useProductsMock: vi.fn() }));

vi.mock('./useProducts', () => ({
    useProducts: useProductsMock,
}));

const BUSINESS = { id: 'biz-1' };

// Mois lus dans le fuseau du commerce (heure de Dakar, voir lib/dates) : le
// 1er du mois à 00h30 heure de Paris, on est encore le mois précédent à
// Dakar, et des fixtures construites en heure locale tomberaient alors dans
// le mauvais mois.
const { year: currentYear, month: currentMonth } = zonedYearMonth();
const thisMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 10, 9, 0, 0));
const lastMonth = new Date(Date.UTC(currentYear, currentMonth - 2, 10, 9, 0, 0));

const SALES = [
    { id: 's1', total_price: 3000, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
    { id: 's2', total_price: 2000, created_at: thisMonth.toISOString(), products: { name: 'Pneu' }, receipts: { status: 'completed', payment_method: 'mobile_money' } },
    { id: 's3', total_price: 5000, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'credit' } },
    { id: 's4', total_price: 1000, created_at: lastMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
];

// Une dette porte désormais ses versements : c'est chaque versement qui entre
// en caisse, à sa propre date, pas la dette entière le jour où elle se solde.
const DEBTS = [
    {
        id: 'd1', customer_name: 'Moussa', amount: 1500, status: 'paid', paid_at: thisMonth.toISOString(),
        payments: [{ id: 'dp1', amount: 1500, payment_method: null, paid_at: thisMonth.toISOString() }],
    },
    { id: 'd2', customer_name: 'Awa', amount: 800, status: 'unpaid', payments: [] },
];

const EXPENSES = [
    { id: 'e1', category: 'transport', amount: 700, created_at: thisMonth.toISOString() },
    { id: 'e2', category: 'divers', amount: 400, created_at: lastMonth.toISOString() },
];

describe('useFinances', () => {
    beforeEach(() => {
        fetchAllSalesMock.mockReset();
        fetchExpensesMock.mockReset();
        fetchDebtsMock.mockReset();
        fetchPurchaseOrdersMock.mockReset();
        useProductsMock.mockReset();
        fetchAllSalesMock.mockResolvedValue(SALES);
        fetchExpensesMock.mockResolvedValue(EXPENSES);
        fetchDebtsMock.mockResolvedValue(DEBTS);
        fetchPurchaseOrdersMock.mockResolvedValue([]);
        fetchMoneyAccountsMock.mockReset();
        fetchMoneyAccountsMock.mockResolvedValue([]);
        useProductsMock.mockReturnValue({ data: [], isLoading: false });
    });

    it('computes total revenue as collected sales plus repaid debts, excluding credit sales and unpaid debts', async () => {
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // (3000 cash + 2000 mobile + 1000 last month) + 1500 repaid debt = 7500
        // the 5000 credit sale and the 800 unpaid debt are excluded
        expect(result.current.totalRevenue).toBe(7500);
        expect(result.current.totalCashOut).toBe(1100);
        // aucune vente de ces fixtures ne porte son coût : la marge connue est
        // donc nulle, et le bénéfice se réduit aux frais de fonctionnement
        expect(result.current.netProfit).toBe(-1100);
        expect(result.current.pendingDebtsTotal).toBe(800);
    });

    // Le 15 du mois à midi : les ventes des fixtures (le 10) sont passées, et
    // la comparaison porte sur le 1er–15 du mois dernier. Date fixe, pour que
    // le test ne dépende pas du jour où il est lancé.
    const MID_MONTH = { now: Date.UTC(currentYear, currentMonth - 1, 15, 12) };

    it('computes this-month figures and compares with last month up to the same date', async () => {
        fetchAllSalesMock.mockResolvedValue([
            ...SALES,
            // le 20 du mois dernier : après la même date, donc hors comparaison
            { id: 's5', total_price: 9000, created_at: new Date(Date.UTC(currentYear, currentMonth - 2, 20, 9)).toISOString(), products: { name: 'Pneu' }, receipts: { status: 'completed', payment_method: 'cash' } },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS, MID_MONTH));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // this month: 3000 + 2000 (sales) + 1500 (repaid debt) = 6500
        expect(result.current.revenueThisMonth).toBe(6500);
        expect(result.current.expensesThisMonth).toBe(700);
        // marge inconnue sur ces ventes -> le mois ne porte que ses dépenses
        expect(result.current.profitThisMonth).toBe(-700);
        // seule la vente du 10 du mois dernier compte, pas celle du 20 : le
        // 15, un mois entamé ne se compare pas à un mois entier
        expect(result.current.revenueLastMonthSoFar).toBe(1000);
        expect(result.current.isFirstTrackedMonth).toBe(false);
    });

    it('recognises the first month tracked, instead of comparing with an empty month', async () => {
        // commerce suivi depuis ce mois-ci : le mois dernier n'était pas « à
        // zéro », il n'était pas suivi, et « +100 % » n'aurait aucun sens
        fetchAllSalesMock.mockResolvedValue(SALES.filter((sale) => sale.created_at === thisMonth.toISOString()));
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS, MID_MONTH));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isFirstTrackedMonth).toBe(true);
    });

    it('stays sober with no revenue at all', async () => {
        fetchAllSalesMock.mockResolvedValue([]);
        fetchDebtsMock.mockResolvedValue([]);
        fetchExpensesMock.mockResolvedValue([]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS, MID_MONTH));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.revenueLastMonthSoFar).toBe(0);
        expect(result.current.totalRevenue).toBe(0);
        expect(result.current.isFirstTrackedMonth).toBe(false);
    });

    it('rounds amounts to the franc, which has no cents', async () => {
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS, MID_MONTH));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // un bénéfice de 12 749,86 s'affichait avec ses centimes
        expect(result.current.formatFCFA(12749.86)).toBe('12\u00A0750');
    });

    it('counts a received purchase order as money out, but never against the profit', async () => {
        fetchPurchaseOrdersMock.mockResolvedValue([
            { id: 'po1', status: 'received', total_amount: 2000, received_at: thisMonth.toISOString(), created_at: thisMonth.toISOString() },
            { id: 'po2', status: 'pending', total_amount: 9000, created_at: thisMonth.toISOString() },
            { id: 'po3', status: 'cancelled', total_amount: 5000, created_at: thisMonth.toISOString() },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // trésorerie : 1100 de dépenses + les 2000 du bon réellement reçu
        expect(result.current.totalCashOut).toBe(3100);

        // mais le stock acheté n'est pas une perte : son coût ne compte qu'une
        // fois vendu (costOfGoodsSold). Le déduire ici aussi le compterait
        // deux fois, et ferait plonger le bénéfice à chaque réappro.
        expect(result.current.operatingExpenses).toBe(1100);
        expect(result.current.netProfit).toBe(-1100);
        expect(result.current.expensesThisMonth).toBe(700);
    });

    it('builds the profit from the margin actually made, not from the money collected', async () => {
        fetchAllSalesMock.mockResolvedValue([
            // vendu 3000, marchandise achetée 1800 -> 1200 de marge
            { id: 's1', total_price: 3000, total_cost: 1800, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
            // vendu 2000, achetée 1500 -> 500 de marge
            { id: 's2', total_price: 2000, total_cost: 1500, created_at: thisMonth.toISOString(), products: { name: 'Pneu' }, receipts: { status: 'completed', payment_method: 'mobile_money' } },
        ]);
        fetchDebtsMock.mockResolvedValue([]);
        fetchExpensesMock.mockResolvedValue([
            { id: 'e1', category: 'transport', amount: 700, created_at: thisMonth.toISOString() },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // 5000 encaissés, mais la marchandise en a coûté 3300
        expect(result.current.totalRevenue).toBe(5000);
        expect(result.current.costOfGoodsSold).toBe(3300);
        expect(result.current.salesMargin).toBe(1700);
        // bénéfice = marge − frais de fonctionnement, pas chiffre d'affaires −
        // dépenses : vendre 5000 de marchandise achetée 3300 ne rapporte
        // pas 5000
        expect(result.current.netProfit).toBe(1000);
        expect(result.current.profitThisMonth).toBe(1000);
    });

    it('leaves a repaid debt out of the profit, since it carries no margin', async () => {
        fetchAllSalesMock.mockResolvedValue([]);
        fetchExpensesMock.mockResolvedValue([]);
        fetchDebtsMock.mockResolvedValue([
            {
                id: 'd1', amount: 5000, status: 'paid', paid_at: thisMonth.toISOString(), payment_method: 'cash',
                payments: [{ id: 'dp1', amount: 5000, payment_method: 'cash', paid_at: thisMonth.toISOString() }],
            },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // l'argent rentre bien...
        expect(result.current.totalRevenue).toBe(5000);
        // ...mais récupérer une créance ne crée aucune marge
        expect(result.current.netProfit).toBe(0);
    });

    it('counts an instalment on the day it was received, and only what is still owed', async () => {
        // un client doit 10 000 et donne 5 000 : l'avance entre en caisse tout
        // de suite, et il ne reste plus que 5 000 en attente. Compter la dette
        // entière au moment du solde daterait cette avance du mauvais jour.
        fetchAllSalesMock.mockResolvedValue([]);
        fetchExpensesMock.mockResolvedValue([]);
        fetchDebtsMock.mockResolvedValue([
            {
                id: 'd1', customer_name: 'Awa', amount: 10000, status: 'unpaid',
                payments: [{ id: 'dp1', amount: 5000, payment_method: 'cash', paid_at: thisMonth.toISOString() }],
            },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.totalRevenue).toBe(5000);
        expect(result.current.revenueThisMonth).toBe(5000);
        expect(result.current.pendingDebtsTotal).toBe(5000);
    });

    it('computes the potential profit of the current stock, excluding products with no cost price', async () => {
        useProductsMock.mockReturnValue({
            data: [
                { id: 'p1', name: 'Casque Moto', price: 5000, cost_price: 3000, stock_quantity: 10 },
                { id: 'p2', name: 'Pneu', price: 8000, cost_price: null, stock_quantity: 5 },
            ],
            isLoading: false,
        });
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // sale value: 5000*10 (Casque) + 8000*5 (Pneu, no cost price) = 90000
        expect(result.current.stockSaleValue).toBe(90000);
        // cost/profit only count the product with a cost price (Casque)
        expect(result.current.stockCost).toBe(30000);
        expect(result.current.stockPotentialProfit).toBe(20000);
        expect(result.current.productsWithoutCostPriceCount).toBe(1);
        expect(result.current.productsWithoutCostPrice).toEqual([{ id: 'p2', name: 'Pneu' }]);
        // bénéfice déjà réalisé (−1100 : que des dépenses, aucune marge
        // connue sur les fixtures) + la marge que le stock restant rapporterait
        expect(result.current.projectedTotalProfit).toBe(-1100 + 20000);
    });

    it('reports no balance for a method with no account declared', async () => {
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // rien n'est supposé : sans point de départ déclaré, l'app ne prétend
        // pas savoir ce qu'il y a dans le tiroir
        expect(result.current.cashBalance).toBeNull();
        expect(result.current.mobileBalance).toBeNull();
        expect(result.current.totalOnHand).toBe(0);
    });

    it('moves the balance with what came in and what went out after the starting point', async () => {
        const openedAt = new Date(thisMonth.getTime() - 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 10000, opening_at: openedAt },
        ]);
        fetchExpensesMock.mockResolvedValue([
            { id: 'e1', category: 'transport', amount: 700, payment_method: 'cash', created_at: thisMonth.toISOString() },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // 10 000 de départ + 3 000 de vente en espèces − 700 de dépense en espèces
        expect(result.current.cashBalance.opening).toBe(10000);
        expect(result.current.cashBalance.current).toBe(12300);
        expect(result.current.totalOnHand).toBe(12300);
    });

    it('ignores movements made before the starting point, already included in it', async () => {
        // point de départ déclaré après la vente : compter celle-ci en plus
        // reviendrait à la compter deux fois
        const openedAt = new Date(thisMonth.getTime() + 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 10000, opening_at: openedAt },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.cashBalance.current).toBe(10000);
        expect(result.current.cashBalance.movements).toBe(0);
    });

    it('does not take a Mobile Money expense out of the cash drawer', async () => {
        const openedAt = new Date(thisMonth.getTime() - 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 10000, opening_at: openedAt },
            { id: 'a2', name: 'Wave', kind: 'mobile_money', opening_balance: 5000, opening_at: openedAt },
        ]);
        fetchExpensesMock.mockResolvedValue([
            { id: 'e1', category: 'transport', amount: 700, payment_method: 'mobile_money', created_at: thisMonth.toISOString() },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // la caisse ne bouge que de sa propre vente (3 000), la dépense Wave
        // sort du solde Mobile Money
        expect(result.current.cashBalance.current).toBe(13000);
        expect(result.current.mobileBalance.current).toBe(5000 + 2000 - 700);
    });

    it('keeps the history of an existing account when a second one is added on the same method', async () => {
        // cas réel : Orange Money créé à 0 aujourd'hui, bien après Wave. Prendre
        // la déclaration la plus récente du groupe effaçait les encaissements
        // Wave des jours précédents — 7 800 F d'argent réel disparus du solde
        // comme du chiffre d'affaires, sans qu'aucune vente ne soit touchée.
        const waveOpenedAt = new Date(thisMonth.getTime() - 60 * 60 * 1000).toISOString();
        const orangeOpenedAt = new Date(thisMonth.getTime() + 24 * 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Wave', kind: 'mobile_money', opening_balance: 39000, initial_balance: 39000, opening_at: waveOpenedAt, created_at: waveOpenedAt },
            { id: 'a2', name: 'Orange Money', kind: 'mobile_money', opening_balance: 0, initial_balance: 0, opening_at: orangeOpenedAt, created_at: orangeOpenedAt },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // les 2 000 de vente Mobile Money comptent toujours
        expect(result.current.mobileBalance.current).toBe(41000);
        expect(result.current.revenueBeforeApp).toBe(39000);
        // 2 000 Mobile Money + 1 500 de dette remboursée, plus les ventes en
        // espèces (aucune caisse déclarée ici, donc rien ne les borne)
        expect(result.current.recordedRevenue).toBe(2000 + 1500 + 3000 + 1000);
    });

    it('holds the total revenue steady when a balance is corrected afterwards', async () => {
        // redéclarer un solde redate opening_at : si le chiffre d'affaires en
        // dépendait, il baisserait tout seul à chaque correction du tiroir.
        const createdAt = new Date(thisMonth.getTime() - 60 * 60 * 1000).toISOString();
        const correctedAt = new Date(thisMonth.getTime() + 24 * 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 25000, initial_balance: 10000, opening_at: correctedAt, created_at: createdAt },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // le chiffre d'affaires part de la première déclaration (10 000) et
        // garde les ventes enregistrées depuis
        expect(result.current.revenueBeforeApp).toBe(10000);
        expect(result.current.totalRevenue).toBe(10000 + 6500);
        // le solde en main, lui, obéit bien à la correction la plus récente
        expect(result.current.cashBalance.current).toBe(25000);
    });

    it('counts what the shop had already earned before the app in the total revenue', async () => {
        // un commerce qui tourne depuis des années n'a pas de "capital de
        // départ" : les 15 000 déclarés viennent eux aussi de ses ventes,
        // simplement de ventes faites avant qu'on ne les enregistre ici
        const openedAt = new Date(thisMonth.getTime() - 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 10000, opening_at: openedAt },
            { id: 'a2', name: 'Wave', kind: 'mobile_money', opening_balance: 5000, opening_at: openedAt },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.revenueBeforeApp).toBe(15000);
        // 3 000 espèces + 2 000 Wave + 1 500 de dette remboursée ; la vente du
        // mois dernier est antérieure au point de départ, elle est déjà dedans
        expect(result.current.recordedRevenue).toBe(6500);
        expect(result.current.totalRevenue).toBe(15000 + 6500);
    });

    it('never counts a sale twice when it is already inside the declared balance', async () => {
        // point de départ déclaré après toutes les ventes : le chiffre
        // d'affaires ne doit pas les rajouter par-dessus les 15 000
        const openedAt = new Date(thisMonth.getTime() + 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 10000, opening_at: openedAt },
            { id: 'a2', name: 'Wave', kind: 'mobile_money', opening_balance: 5000, opening_at: openedAt },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.recordedRevenue).toBe(0);
        expect(result.current.totalRevenue).toBe(15000);
    });

    it('leaves the declared balance out of the profit, having no known purchase cost', async () => {
        const openedAt = new Date(thisMonth.getTime() - 60 * 60 * 1000).toISOString();
        fetchMoneyAccountsMock.mockResolvedValue([
            { id: 'a1', name: 'Caisse', kind: 'cash', opening_balance: 10000, opening_at: openedAt },
        ]);
        fetchAllSalesMock.mockResolvedValue([
            { id: 's1', total_price: 3000, total_cost: 1800, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
        ]);
        fetchDebtsMock.mockResolvedValue([]);
        fetchExpensesMock.mockResolvedValue([]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // le chiffre d'affaires porte les 10 000 d'avant l'app...
        expect(result.current.totalRevenue).toBe(13000);
        // ...mais on ignore ce que cette marchandise-là avait coûté : la marge
        // ne se calcule que sur les ventes enregistrées ici
        expect(result.current.revenueOfSoldGoods).toBe(3000);
        expect(result.current.salesMargin).toBe(1200);
        expect(result.current.netProfit).toBe(1200);
    });

    it('computes sales margin from total_cost frozen at sale time, excluding sales with an unknown cost', async () => {
        fetchAllSalesMock.mockResolvedValue([
            { id: 's1', total_price: 3000, total_cost: 2000, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'cash' } },
            // à crédit : compte quand même dans la marge, contrairement au chiffre d'affaires encaissé
            { id: 's2', total_price: 5000, total_cost: 3500, created_at: thisMonth.toISOString(), products: { name: 'Casque Moto' }, receipts: { status: 'completed', payment_method: 'credit' } },
            // vente d'avant l'activation du suivi (total_cost absent) : marge inconnue, pas comptée comme 0
            { id: 's3', total_price: 1000, total_cost: null, created_at: lastMonth.toISOString(), products: { name: 'Pneu' }, receipts: { status: 'completed', payment_method: 'cash' } },
        ]);
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // (3000-2000) + (5000-3500) = 2500
        expect(result.current.salesMargin).toBe(2500);
        expect(result.current.salesWithoutCostCount).toBe(1);
    });

    it('reports isLoading while the product list is still loading', async () => {
        useProductsMock.mockReturnValue({ data: undefined, isLoading: true });
        const { result } = renderHookWithQueryClient(() => useFinances(BUSINESS));

        expect(result.current.isLoading).toBe(true);
    });
});
