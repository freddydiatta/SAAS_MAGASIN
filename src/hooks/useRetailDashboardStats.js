import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProducts } from './useProducts';
import { fetchExpenses } from '../services/expensesService';
import { fetchDebts } from '../services/debtsService';
import { fetchPurchaseOrders } from '../services/purchaseOrdersService';

const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ');

// Tous les calculs de KPI du tableau de bord commerce (caisse du jour,
// variation vs hier, panier moyen, alertes stock, graphique 7 jours, top
// produits) : sorti de RetailDashboard.jsx, qui mélangeait ces calculs avec
// le rendu des cartes/graphique dans un seul fichier de 300+ lignes.
export function useRetailDashboardStats(selectedBusiness) {
    const { user } = useAuth();

    const { data: products = [] } = useProducts(selectedBusiness?.id);

    const { data: sales = [], isLoading: loadingSales } = useQuery({
        queryKey: ['sales', selectedBusiness?.id],
        queryFn: async () => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data, error } = await supabase
                .from('sales')
                .select('*, products(name, type), receipts!inner(status, payment_method)')
                .eq('business_id', selectedBusiness?.id)
                .eq('receipts.status', 'completed')
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!user && !!selectedBusiness
    });

    // Même clé de requête que useExpenses (['expenses', businessId]) pour
    // partager le cache React Query plutôt que refaire la requête.
    const { data: expenses = [] } = useQuery({
        queryKey: ['expenses', selectedBusiness?.id],
        queryFn: () => fetchExpenses(selectedBusiness.id),
        enabled: !!user && !!selectedBusiness
    });

    // Même clé que useDebts : une dette remboursée aujourd'hui est de
    // l'argent qui vient réellement de rentrer en caisse, même si la vente
    // à crédit d'origine remonte à avant aujourd'hui.
    const { data: debts = [] } = useQuery({
        queryKey: ['debts', selectedBusiness?.id],
        queryFn: () => fetchDebts(selectedBusiness.id),
        enabled: !!user && !!selectedBusiness
    });

    // Même clé que useFournisseurs : un bon de commande reçu aujourd'hui est
    // de l'argent réellement sorti vers un fournisseur, une vraie dépense du
    // jour au même titre que transport/loyer/divers.
    const { data: purchaseOrders = [] } = useQuery({
        queryKey: ['purchase_orders', selectedBusiness?.id],
        queryFn: () => fetchPurchaseOrders(selectedBusiness.id),
        enabled: !!user && !!selectedBusiness
    });

    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Une vente à crédit (voir Caisse.jsx) n'a pas encore été payée — la
    // compter dans "Caisse du jour" ferait apparaître comme encaissé de
    // l'argent que le commerçant n'a en réalité pas en main tant que le
    // client n'a pas remboursé sa dette (voir Dettes.jsx).
    const isCashCollected = (sale) => sale.receipts?.payment_method !== 'credit';

    const salesToday = sales.filter(s => new Date(s.created_at).getTime() >= today);
    const salesYesterday = sales.filter(s => {
        const time = new Date(s.created_at).getTime();
        return time >= yesterday.getTime() && time < today;
    });
    const collectedSalesToday = salesToday.filter(isCashCollected);
    const collectedSalesYesterday = salesYesterday.filter(isCashCollected);

    const debtsRepaidToday = debts.filter(d => d.status === 'paid' && d.paid_at && new Date(d.paid_at).getTime() >= today);
    const debtsRepaidYesterday = debts.filter(d => {
        if (d.status !== 'paid' || !d.paid_at) return false;
        const time = new Date(d.paid_at).getTime();
        return time >= yesterday.getTime() && time < today;
    });
    const caisseDuJourRembourse = debtsRepaidToday.reduce((sum, d) => sum + Number(d.amount), 0);
    const caisseHierRembourse = debtsRepaidYesterday.reduce((sum, d) => sum + Number(d.amount), 0);

    // Total des ventes du jour encaissées (hors remboursements) : sert de
    // base au panier moyen, un remboursement de dette n'étant pas un panier.
    const ventesCollecteesDuJour = collectedSalesToday.reduce((sum, sale) => sum + Number(sale.total_price), 0);
    const ventesCollecteesHier = collectedSalesYesterday.reduce((sum, sale) => sum + Number(sale.total_price), 0);

    const caisseDuJour = ventesCollecteesDuJour + caisseDuJourRembourse;
    const caisseHier = ventesCollecteesHier + caisseHierRembourse;

    const caisseDuJourCash = salesToday
        .filter(sale => sale.receipts?.payment_method === 'cash')
        .reduce((sum, sale) => sum + Number(sale.total_price), 0);

    const caisseDuJourMobile = salesToday
        .filter(sale => sale.receipts?.payment_method === 'mobile_money')
        .reduce((sum, sale) => sum + Number(sale.total_price), 0);

    const caisseDuJourCredit = salesToday
        .filter(sale => sale.receipts?.payment_method === 'credit')
        .reduce((sum, sale) => sum + Number(sale.total_price), 0);

    // Calculate % change (prevent divide by zero)
    const percentChange = caisseHier > 0
        ? Math.round(((caisseDuJour - caisseHier) / caisseHier) * 100)
        : (caisseDuJour > 0 ? 100 : 0);

    const panierMoyen = collectedSalesToday.length > 0 ? Math.round(ventesCollecteesDuJour / collectedSalesToday.length) : 0;
    const transactions = salesToday.length;

    const transactionsHier = salesYesterday.length;
    const diffTransactions = transactions - transactionsHier;

    const lowStockProducts = products.filter(p => p.stock_quantity <= 2);
    const alertesStock = lowStockProducts.length;

    const receivedOrdersToday = purchaseOrders.filter(o => {
        if (o.status !== 'received' || !o.received_at) return false;
        return new Date(o.received_at).getTime() >= today;
    });

    const depensesDuJour = expenses
        .filter(e => new Date(e.created_at).getTime() >= today)
        .reduce((sum, e) => sum + Number(e.amount), 0)
        + receivedOrdersToday.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const beneficeDuJour = caisseDuJour - depensesDuJour;

    // --- Chart Data (Last 7 Days) ---
    const chartData = [];
    let total7Days = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        // Même logique que caisseDuJour : une vente à crédit ce jour-là
        // n'était pas de l'argent encaissé, donc pas de revenu réel.
        const daySales = sales.filter(s => {
            const time = new Date(s.created_at).getTime();
            return time >= d.getTime() && time < nextD.getTime();
        }).filter(isCashCollected);

        const dayTotal = daySales.reduce((sum, s) => sum + Number(s.total_price), 0);
        total7Days += dayTotal;

        chartData.push({
            name: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
            total: dayTotal
        });
    }

    // --- Top Products ---
    // La quantité vendue compte toutes les ventes (le produit est bien
    // parti, crédit ou pas) ; le revenu affiché ne compte que l'argent
    // réellement encaissé, même logique que caisseDuJour.
    const productStats = {};
    sales.forEach(sale => {
        const name = sale.products?.name || 'Inconnu';
        if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 };
        productStats[name].quantity += sale.quantity;
        if (isCashCollected(sale)) {
            productStats[name].revenue += Number(sale.total_price);
        }
    });

    const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3);

    return {
        loadingSales,
        caisseDuJour,
        caisseDuJourCash,
        caisseDuJourMobile,
        caisseDuJourCredit,
        caisseDuJourRembourse,
        depensesDuJour,
        beneficeDuJour,
        percentChange,
        panierMoyen,
        transactions,
        diffTransactions,
        alertesStock,
        lowStockProducts,
        chartData,
        total7Days,
        topProducts,
        formatFCFA,
    };
}
