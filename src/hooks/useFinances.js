import { useQuery } from '@tanstack/react-query';
import { fetchAllSales } from '../services/financesService';
import { fetchExpenses } from '../services/expensesService';
import { fetchDebts } from '../services/debtsService';
import { fetchPurchaseOrders } from '../services/purchaseOrdersService';
import { useProducts } from './useProducts';

const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ');

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const monthKey = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${d.getMonth()}`;
};

// Vue d'ensemble des gains réels du commerce (chiffre d'affaires total,
// bénéfice, tendance mensuelle) — contrairement à "Caisse du jour"
// (RetailDashboard), qui ne montre que la journée en cours. Même définition
// de "argent encaissé" que useRetailDashboardStats : ventes cash/mobile +
// dettes remboursées, jamais les ventes à crédit encore en attente.
export function useFinances(selectedBusiness) {
    const businessId = selectedBusiness?.id;

    const { data: sales = [], isLoading: loadingSales } = useQuery({
        queryKey: ['finances-sales', businessId],
        queryFn: () => fetchAllSales(businessId),
        enabled: !!businessId,
    });

    // Même clé que useExpenses : partage le cache plutôt que refaire la requête.
    const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
        queryKey: ['expenses', businessId],
        queryFn: () => fetchExpenses(businessId),
        enabled: !!businessId,
    });

    // Même clé que useDebts.
    const { data: debts = [], isLoading: loadingDebts } = useQuery({
        queryKey: ['debts', businessId],
        queryFn: () => fetchDebts(businessId),
        enabled: !!businessId,
    });

    // Même clé que useFournisseurs (['purchase_orders', businessId]).
    const { data: purchaseOrders = [], isLoading: loadingOrders } = useQuery({
        queryKey: ['purchase_orders', businessId],
        queryFn: () => fetchPurchaseOrders(businessId),
        enabled: !!businessId,
    });

    // Même clé que useProducts (Stock.jsx) : sert au bénéfice potentiel du
    // stock restant, pas seulement à ce qui a déjà été vendu.
    const { data: products = [], isLoading: loadingProducts } = useProducts(businessId);

    const isLoading = loadingSales || loadingExpenses || loadingDebts || loadingOrders || loadingProducts;

    const collectedSales = sales.filter(s => s.receipts?.payment_method !== 'credit');
    const paidDebts = debts.filter(d => d.status === 'paid');
    const pendingDebtsTotal = debts
        .filter(d => d.status !== 'paid')
        .reduce((sum, d) => sum + Number(d.amount), 0);

    // Un bon de commande "en attente" n'est pas encore payé au fournisseur —
    // seul un bon "reçu" représente de l'argent réellement sorti (et donc
    // une vraie dépense), daté du jour de la réception, pas de la commande.
    const receivedOrders = purchaseOrders.filter(o => o.status === 'received');

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        + receivedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const totalRevenue = collectedSales.reduce((sum, s) => sum + Number(s.total_price), 0)
        + paidDebts.reduce((sum, d) => sum + Number(d.amount), 0);
    const netProfit = totalRevenue - totalExpenses;

    // --- Regroupement par mois (revenu / dépenses) ---
    const revenueByMonth = {};
    collectedSales.forEach(s => {
        const key = monthKey(s.created_at);
        revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(s.total_price);
    });
    paidDebts.forEach(d => {
        const key = monthKey(d.paid_at || d.created_at);
        revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(d.amount);
    });

    const expensesByMonth = {};
    expenses.forEach(e => {
        const key = monthKey(e.created_at);
        expensesByMonth[key] = (expensesByMonth[key] || 0) + Number(e.amount);
    });
    receivedOrders.forEach(o => {
        const key = monthKey(o.received_at || o.created_at);
        expensesByMonth[key] = (expensesByMonth[key] || 0) + Number(o.total_amount);
    });

    const now = new Date();
    const currentMonthKey = monthKey(now);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = monthKey(lastMonthDate);

    const revenueThisMonth = revenueByMonth[currentMonthKey] || 0;
    const revenueLastMonth = revenueByMonth[lastMonthKey] || 0;
    const expensesThisMonth = expensesByMonth[currentMonthKey] || 0;
    const profitThisMonth = revenueThisMonth - expensesThisMonth;

    const percentChangeMonth = revenueLastMonth > 0
        ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
        : (revenueThisMonth > 0 ? 100 : 0);

    // --- Tendance sur les 6 derniers mois ---
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = monthKey(d);
        const revenue = revenueByMonth[key] || 0;
        const monthExpenses = expensesByMonth[key] || 0;
        monthlyTrend.push({
            name: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
            revenue,
            expenses: monthExpenses,
            profit: revenue - monthExpenses,
        });
    }

    // --- Potentiel du stock restant ---
    // Ce que rapporterait le stock actuel s'il était entièrement vendu — un
    // stock a de la valeur même avant d'être vendu, ce que ne montrent ni la
    // caisse du jour ni le chiffre d'affaires (qui ne comptent que ce qui
    // est déjà arrivé). Le prix de vente est toujours connu, mais un produit
    // sans prix d'achat renseigné (voir Stock.jsx) ne peut pas entrer dans
    // le coût / bénéfice potentiel — juste dans la valeur de vente brute.
    const productsWithCostPrice = products.filter(p => p.cost_price != null);
    // Le nombre seul ne dit pas lesquels aller corriger dans Stock — le nom
    // de chacun permet de les retrouver directement par la recherche.
    const productsWithoutCostPrice = products.filter(p => p.cost_price == null).map(p => ({ id: p.id, name: p.name }));
    const productsWithoutCostPriceCount = productsWithoutCostPrice.length;

    const stockSaleValue = products.reduce((sum, p) => sum + Number(p.price) * Number(p.stock_quantity), 0);
    const stockCost = productsWithCostPrice.reduce((sum, p) => sum + Number(p.cost_price) * Number(p.stock_quantity), 0);
    const stockPotentialProfit = productsWithCostPrice.reduce(
        (sum, p) => sum + (Number(p.price) - Number(p.cost_price)) * Number(p.stock_quantity),
        0
    );

    // "Si on vend tout ce qu'il reste" = ce qui est déjà gagné + ce que le
    // stock restant rapporterait — la vraie réponse à "est-ce qu'on est
    // gagnant au total", pas juste sur le mois en cours.
    const projectedTotalProfit = netProfit + stockPotentialProfit;

    return {
        isLoading,
        totalRevenue,
        totalExpenses,
        netProfit,
        revenueThisMonth,
        expensesThisMonth,
        profitThisMonth,
        percentChangeMonth,
        pendingDebtsTotal,
        monthlyTrend,
        stockSaleValue,
        stockCost,
        stockPotentialProfit,
        productsWithoutCostPrice,
        productsWithoutCostPriceCount,
        projectedTotalProfit,
        formatFCFA,
    };
}
