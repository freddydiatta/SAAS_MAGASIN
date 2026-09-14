import { useQuery } from '@tanstack/react-query';
import { fetchAllSales } from '../services/financesService';
import { fetchExpenses } from '../services/expensesService';
import { fetchDebts } from '../services/debtsService';
import { fetchPurchaseOrders } from '../services/purchaseOrdersService';
import { useProducts } from './useProducts';
// Regroupement mensuel en heure de Dakar : une vente du 31 août à 23h30 est
// d'août pour le commerçant, alors qu'un appareil réglé sur Paris la datait
// du 1er septembre et la basculait dans le mois suivant.
import { monthKey, monthKeyFromOffset } from '../lib/dates';
import { useMoneyAccounts } from './useMoneyAccounts';

const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ');

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Vue d'ensemble des gains réels du commerce (chiffre d'affaires total,
// bénéfice, tendance mensuelle) — contrairement à "Caisse du jour"
// (RetailDashboard), qui ne montre que la journée en cours. Même définition
// de "argent encaissé" que useRetailDashboardStats : ventes cash/mobile +
// dettes remboursées, jamais les ventes à crédit encore en attente.
//
// Le chiffre d'affaires total part en plus des soldes déclarés : un commerce
// qui tourne depuis des années avait déjà gagné cet argent avant d'ouvrir
// l'application, et l'exclure donnait un total plus petit que ce que le
// commerçant a réellement en main — le chiffre paraissait faux.
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

    // Points de départ déclarés des comptes (caisse, Wave...) : ils servent
    // de base aux soldes courants calculés plus bas.
    const { accounts } = useMoneyAccounts(selectedBusiness);

    const isLoading = loadingSales || loadingExpenses || loadingDebts || loadingOrders || loadingProducts;

    const collectedSales = sales.filter(s => s.receipts?.payment_method !== 'credit');
    const paidDebts = debts.filter(d => d.status === 'paid');

    // Marge réelle sur les ventes : prix de vente moins le coût réellement
    // payé AU MOMENT de chaque vente (total_cost, figé par process_sale),
    // pas le prix d'achat actuel du produit — qui change à chaque
    // réapprovisionnement (voir receive_purchase_order) et fausserait donc
    // rétroactivement la marge de ventes déjà passées s'il était réutilisé
    // ici. Basé sur toutes les ventes complétées (y compris à crédit,
    // remboursées ou non) : contrairement à totalRevenue, il ne s'agit pas
    // d'argent encaissé mais de la marge sur la marchandise déjà sortie.
    const salesWithKnownCost = sales.filter(s => s.total_cost != null);
    const costOfGoodsSold = salesWithKnownCost.reduce((sum, s) => sum + Number(s.total_cost), 0);
    const revenueOfSoldGoods = salesWithKnownCost.reduce((sum, s) => sum + Number(s.total_price), 0);
    const salesMargin = revenueOfSoldGoods - costOfGoodsSold;
    // Ventes faites avant l'activation de ce suivi, ou d'un produit sans
    // prix d'achat renseigné à l'instant de la vente — leur marge est
    // inconnue plutôt que comptée comme 0.
    const salesWithoutCostCount = sales.length - salesWithKnownCost.length;
    const pendingDebtsTotal = debts
        .filter(d => d.status !== 'paid')
        .reduce((sum, d) => sum + Number(d.amount), 0);

    // Un bon de commande "en attente" n'est pas encore payé au fournisseur —
    // seul un bon "reçu" représente de l'argent réellement sorti (et donc
    // une vraie dépense), daté du jour de la réception, pas de la commande.
    const receivedOrders = purchaseOrders.filter(o => o.status === 'received');

    // --- Ce qu'il reste réellement en caisse et sur Mobile Money ---
    // Solde courant d'un moyen de paiement : le point de départ déclaré
    // (money_accounts), plus ce qui est entré par ce moyen depuis cette date,
    // moins ce qui en est sorti. Le montant saisi décrit ce qu'on avait en
    // main à un instant précis : ne compter que les mouvements postérieurs
    // évite de compter deux fois des ventes déjà incluses dedans.
    //
    // Quand plusieurs comptes partagent un moyen (Wave et Orange Money), un
    // encaissement "mobile money" n'indique pas sur lequel il est arrivé :
    // le solde se raisonne donc par moyen, pas par compte, et les mouvements
    // comptent à partir du point de départ le plus récent du groupe.
    const balanceFor = (kind, method) => {
        const group = accounts.filter((account) => account.kind === kind);
        if (group.length === 0) return null;

        const opening = group.reduce((sum, account) => sum + Number(account.opening_balance), 0);
        const since = Math.max(...group.map((account) => new Date(account.opening_at).getTime()));
        const after = (dateStr) => dateStr && new Date(dateStr).getTime() >= since;

        const salesIn = sales
            .filter((s) => s.receipts?.payment_method === method && after(s.created_at))
            .reduce((sum, s) => sum + Number(s.total_price), 0);
        const debtsIn = paidDebts
            .filter((d) => d.payment_method === method && after(d.paid_at || d.created_at))
            .reduce((sum, d) => sum + Number(d.amount), 0);
        const expensesOut = expenses
            .filter((e) => e.payment_method === method && after(e.created_at))
            .reduce((sum, e) => sum + Number(e.amount), 0);
        const ordersOut = receivedOrders
            .filter((o) => o.payment_method === method && after(o.received_at || o.created_at))
            .reduce((sum, o) => sum + Number(o.total_amount), 0);

        return {
            opening,
            since,
            current: opening + salesIn + debtsIn - expensesOut - ordersOut,
            movements: salesIn + debtsIn - expensesOut - ordersOut,
        };
    };

    const cashBalance = balanceFor('cash', 'cash');
    const mobileBalance = balanceFor('mobile_money', 'mobile_money');
    const totalOnHand = (cashBalance?.current || 0) + (mobileBalance?.current || 0);

    // Sorties d'argent, achats de stock compris : c'est la trésorerie qui
    // bouge, pas le bénéfice (voir netProfit plus bas).
    const totalCashOut = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        + receivedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    // Ce que le commerce avait déjà en main le jour où les comptes ont été
    // déclarés. Ce n'est pas de l'argent venu d'ailleurs : le commerce tourne
    // depuis des années, cette somme vient elle aussi des ventes — simplement
    // de ventes faites avant qu'on ne les enregistre ici. Elle fait donc
    // partie du chiffre d'affaires, au même titre que les ventes du jour.
    const openingTotal = (cashBalance?.opening || 0) + (mobileBalance?.opening || 0);

    // Et comme ce montant contient déjà tout ce qui est rentré avant lui, on
    // ne compte ensuite que les encaissements postérieurs — exactement la même
    // frontière que les soldes ci-dessus, sinon une vente antérieure serait
    // comptée deux fois. Sans point de départ déclaré, tout compte.
    const declaredSince = [cashBalance, mobileBalance].filter(Boolean).map((b) => b.since);
    const openingSince = (method) => {
        if (method === 'cash') return cashBalance ? cashBalance.since : null;
        if (method === 'mobile_money') return mobileBalance ? mobileBalance.since : null;
        // Moyen inconnu (dette remboursée avant que le moyen ne soit
        // enregistré) : impossible de le rattacher à un solde précis. On
        // retient le point de départ le plus récent, le seul qui ne risque
        // pas de faire compter cet encaissement une deuxième fois.
        return declaredSince.length > 0 ? Math.max(...declaredSince) : null;
    };
    const countsInRevenue = (method, dateStr) => {
        const since = openingSince(method);
        if (since === null) return true;
        return !!dateStr && new Date(dateStr).getTime() >= since;
    };

    // Ce que les ventes enregistrées dans l'application ont rapporté, seules.
    const recordedRevenue = collectedSales
        .filter((s) => countsInRevenue(s.receipts?.payment_method, s.created_at))
        .reduce((sum, s) => sum + Number(s.total_price), 0)
        + paidDebts
            .filter((d) => countsInRevenue(d.payment_method, d.paid_at || d.created_at))
            .reduce((sum, d) => sum + Number(d.amount), 0);

    const totalRevenue = openingTotal + recordedRevenue;

    // Dépenses de fonctionnement seules (transport, loyer...). Les achats de
    // stock en sont exclus volontairement : leur coût arrive dans le bénéfice
    // au moment où la marchandise est vendue (costOfGoodsSold). Les compter
    // ici aussi les déduirait deux fois.
    const operatingExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Bénéfice = ce que les ventes ont réellement rapporté une fois la
    // marchandise payée, moins les frais de fonctionnement. Le chiffre
    // d'affaires seul ne dit rien du bénéfice : vendre 28 500 F de
    // marchandise achetée 22 000 F ne rapporte pas 28 500 F. Un
    // remboursement de dette n'y entre pas : c'est de l'argent qui rentre,
    // pas une marge (la vente d'origine a déjà compté sa marge).
    const netProfit = salesMargin - operatingExpenses;

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

    // Deux regroupements distincts, pour deux questions différentes :
    // cashOutByMonth alimente le graphique des entrées/sorties, tandis que le
    // bénéfice du mois ne retient que les frais de fonctionnement.
    const cashOutByMonth = {};
    const operatingExpensesByMonth = {};
    expenses.forEach(e => {
        const key = monthKey(e.created_at);
        cashOutByMonth[key] = (cashOutByMonth[key] || 0) + Number(e.amount);
        operatingExpensesByMonth[key] = (operatingExpensesByMonth[key] || 0) + Number(e.amount);
    });
    receivedOrders.forEach(o => {
        const key = monthKey(o.received_at || o.created_at);
        cashOutByMonth[key] = (cashOutByMonth[key] || 0) + Number(o.total_amount);
    });

    const marginByMonth = {};
    salesWithKnownCost.forEach(s => {
        const key = monthKey(s.created_at);
        marginByMonth[key] = (marginByMonth[key] || 0)
            + (Number(s.total_price) - Number(s.total_cost));
    });

    const now = new Date();
    const currentMonthKey = monthKeyFromOffset(0, now).key;
    const lastMonthKey = monthKeyFromOffset(1, now).key;

    const revenueThisMonth = revenueByMonth[currentMonthKey] || 0;
    const revenueLastMonth = revenueByMonth[lastMonthKey] || 0;
    const expensesThisMonth = operatingExpensesByMonth[currentMonthKey] || 0;
    const marginThisMonth = marginByMonth[currentMonthKey] || 0;
    const profitThisMonth = marginThisMonth - expensesThisMonth;

    const percentChangeMonth = revenueLastMonth > 0
        ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
        : (revenueThisMonth > 0 ? 100 : 0);

    // --- Tendance sur les 6 derniers mois ---
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
        const { key, monthIndex, year } = monthKeyFromOffset(i, now);
        const revenue = revenueByMonth[key] || 0;
        const monthCashOut = cashOutByMonth[key] || 0;
        monthlyTrend.push({
            name: `${MONTH_LABELS[monthIndex]} ${year}`,
            revenue,
            expenses: monthCashOut,
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
        recordedRevenue,
        openingTotal,
        totalCashOut,
        revenueOfSoldGoods,
        costOfGoodsSold,
        operatingExpenses,
        netProfit,
        revenueThisMonth,
        expensesThisMonth,
        profitThisMonth,
        percentChangeMonth,
        salesMargin,
        salesWithoutCostCount,
        cashBalance,
        mobileBalance,
        totalOnHand,
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
