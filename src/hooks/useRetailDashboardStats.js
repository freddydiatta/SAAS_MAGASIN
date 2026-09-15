import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProducts } from './useProducts';
import { fetchDebts } from '../services/debtsService';
import { startOfDay, formatDate } from '../lib/dates';
import { needsRestock, isOutOfStock, byRestockUrgency } from '../lib/stock';
import { sameTimeYesterday } from '../lib/dayTrend';

const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ');
const DAY_MS = 24 * 60 * 60 * 1000;

// Tous les calculs de KPI du tableau de bord commerce (caisse du jour,
// variation vs hier, panier moyen, alertes stock, graphique 7 jours, top
// produits) : sorti de RetailDashboard.jsx, qui mélangeait ces calculs avec
// le rendu des cartes/graphique dans un seul fichier de 300+ lignes.
//
// `now` n'est à fournir que par les tests : la comparaison avec « hier à la
// même heure » dépend de l'instant présent.
export function useRetailDashboardStats(selectedBusiness, { now = Date.now() } = {}) {
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

    // Même clé que useDebts : une dette remboursée aujourd'hui est de
    // l'argent qui vient réellement de rentrer en caisse, même si la vente
    // à crédit d'origine remonte à avant aujourd'hui.
    const { data: debts = [] } = useQuery({
        queryKey: ['debts', selectedBusiness?.id],
        queryFn: () => fetchDebts(selectedBusiness.id),
        enabled: !!user && !!selectedBusiness
    });

    // Bornes calculées en heure de Dakar (voir lib/dates) : avec le minuit de
    // l'appareil, une vente de 23h passait dans la caisse du lendemain quand
    // le téléphone était réglé sur Paris.
    const today = startOfDay(now);
    // Minuit de la veille : reculer d'une milliseconde retombe forcément dans
    // la journée précédente, sans arithmétique de calendrier local.
    const yesterday = startOfDay(today - 1);

    // Une vente à crédit (voir Caisse.jsx) n'a pas encore été payée — la
    // compter dans "Caisse du jour" ferait apparaître comme encaissé de
    // l'argent que le commerçant n'a en réalité pas en main tant que le
    // client n'a pas remboursé sa dette (voir Dettes.jsx).
    const isCashCollected = (sale) => sale.receipts?.payment_method !== 'credit';

    const salesToday = sales.filter(s => new Date(s.created_at).getTime() >= today);
    // Hier jusqu'à la même heure qu'en ce moment : c'est la seule base de
    // comparaison juste pour une journée pas encore terminée (voir dayTrend).
    const yesterdayCutoff = sameTimeYesterday({ now, todayStart: today, yesterdayStart: yesterday });
    const salesYesterday = sales.filter(s => {
        const time = new Date(s.created_at).getTime();
        return time >= yesterday && time < yesterdayCutoff;
    });
    const collectedSalesToday = salesToday.filter(isCashCollected);
    const collectedSalesYesterday = salesYesterday.filter(isCashCollected);

    // Chaque VERSEMENT compte le jour où il est reçu : une avance de 5 000 ce
    // matin est dans la caisse du jour, même si la dette n'est pas soldée ; et
    // une dette soldée aujourd'hui n'y apporte que son dernier versement, pas
    // les tranches déjà encaissées les jours précédents.
    const debtPayments = debts.flatMap((debt) => (debt.payments || []).map((payment) => ({
        amount: payment.amount,
        payment_method: payment.payment_method,
        paid_at: payment.paid_at,
    })));
    const debtsRepaidToday = debtPayments.filter(p => p.paid_at && new Date(p.paid_at).getTime() >= today);
    const debtsRepaidYesterday = debtPayments.filter(p => {
        if (!p.paid_at) return false;
        const time = new Date(p.paid_at).getTime();
        return time >= yesterday && time < yesterdayCutoff;
    });
    const caisseDuJourRembourse = debtsRepaidToday.reduce((sum, d) => sum + Number(d.amount), 0);
    const caisseHierRembourse = debtsRepaidYesterday.reduce((sum, d) => sum + Number(d.amount), 0);

    // Total des ventes du jour encaissées (hors remboursements) : sert de
    // base au panier moyen, un remboursement de dette n'étant pas un panier.
    const ventesCollecteesDuJour = collectedSalesToday.reduce((sum, sale) => sum + Number(sale.total_price), 0);
    const ventesCollecteesHier = collectedSalesYesterday.reduce((sum, sale) => sum + Number(sale.total_price), 0);

    const caisseDuJour = ventesCollecteesDuJour + caisseDuJourRembourse;
    const caisseHier = ventesCollecteesHier + caisseHierRembourse;

    // Un remboursement de dette compte dans le moyen par lequel le client a
    // réellement remboursé (debts.payment_method, demandé dans Dettes.jsx) :
    // remboursé en liquide, l'argent est bien dans le tiroir ce soir. Ceux
    // enregistrés avant l'ajout de ce choix n'ont pas de moyen connu et
    // restent dans caisseDuJourRembourse, jamais supposés être des espèces.
    const sumRepaidBy = (method) => debtsRepaidToday
        .filter(d => d.payment_method === method)
        .reduce((sum, d) => sum + Number(d.amount), 0);

    const caisseDuJourCash = salesToday
        .filter(sale => sale.receipts?.payment_method === 'cash')
        .reduce((sum, sale) => sum + Number(sale.total_price), 0)
        + sumRepaidBy('cash');

    const caisseDuJourMobile = salesToday
        .filter(sale => sale.receipts?.payment_method === 'mobile_money')
        .reduce((sum, sale) => sum + Number(sale.total_price), 0)
        + sumRepaidBy('mobile_money');

    // Reste des remboursements du jour dont on ne connaît pas le moyen : la
    // seule part qui ne peut pas être rattachée aux espèces ou au Mobile
    // Money, et donc la seule à afficher séparément (sinon les remboursements
    // déjà comptés dans caisseDuJourCash/Mobile seraient comptés deux fois).
    const caisseDuJourMoyenInconnu = debtsRepaidToday
        .filter(d => !d.payment_method)
        .reduce((sum, d) => sum + Number(d.amount), 0);

    const caisseDuJourCredit = salesToday
        .filter(sale => sale.receipts?.payment_method === 'credit')
        .reduce((sum, sale) => sum + Number(sale.total_price), 0);


    const panierMoyen = collectedSalesToday.length > 0 ? Math.round(ventesCollecteesDuJour / collectedSalesToday.length) : 0;
    const transactions = salesToday.length;

    // Même mesure que `transactions` ci-dessus, hier à la même heure.
    const transactionsHier = salesYesterday.length;

    const lowStockProducts = products.filter(needsRestock).sort(byRestockUrgency);
    const alertesStock = lowStockProducts.length;
    const outOfStockCount = lowStockProducts.filter(isOutOfStock).length;

    // --- Chart Data (Last 7 Days) ---
    const chartData = [];
    let total7Days = 0;
    for (let i = 6; i >= 0; i--) {
        // Chaque jour est délimité par ses propres minuits en heure de Dakar,
        // reconstruits en remontant depuis aujourd'hui.
        const dayStart = startOfDay(today - i * DAY_MS);
        const dayEnd = startOfDay(dayStart + DAY_MS);

        // Même logique que caisseDuJour : une vente à crédit ce jour-là
        // n'était pas de l'argent encaissé, donc pas de revenu réel.
        const daySales = sales.filter(s => {
            const time = new Date(s.created_at).getTime();
            return time >= dayStart && time < dayEnd;
        }).filter(isCashCollected);

        const dayTotal = daySales.reduce((sum, s) => sum + Number(s.total_price), 0);
        total7Days += dayTotal;

        chartData.push({
            name: formatDate(dayStart, { weekday: 'short' }),
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
        caisseDuJourMoyenInconnu,
        caisseHier,
        panierMoyen,
        transactions,
        transactionsHier,
        alertesStock,
        outOfStockCount,
        lowStockProducts,
        chartData,
        total7Days,
        topProducts,
        formatFCFA,
    };
}
