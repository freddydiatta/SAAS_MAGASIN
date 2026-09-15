import { useBusiness } from '../../contexts/BusinessContext';
import { useRetailDashboardStats } from '../../hooks/useRetailDashboardStats';
import { AddProductModal } from '../AddProductModal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, ShoppingCart, AlertTriangle, TrendingUp, TrendingDown, Package, CreditCard, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate } from '../../lib/dates';
import { describeDayTrend } from '../../lib/dayTrend';
import { RESTOCK_FILTER } from '../../lib/stock';

// Écart avec hier à la même heure. Un retard ne s'affiche jamais en rouge : la
// journée n'est pas finie, et une alerte à chaque ouverture le matin n'aide
// personne (voir lib/dayTrend).
const DayTrend = ({ trend }) => {
    const toneClass = trend.tone === 'up' ? 'text-emerald-600' : 'text-slate-500';
    const Icon = trend.tone === 'up' ? TrendingUp : trend.tone === 'down' ? TrendingDown : null;
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            {trend.value && (
                <span className={`flex items-center gap-1 font-bold ${toneClass}`}>
                    {Icon && <Icon className="w-4 h-4" />}
                    {trend.value}
                </span>
            )}
            <span className={`font-medium ${trend.value ? 'text-slate-400' : toneClass}`}>{trend.label}</span>
        </div>
    );
};

export const RetailDashboard = () => {
    const { selectedBusiness } = useBusiness();
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const navigate = useNavigate();

    const {
        loadingSales,
        caisseDuJour,
        caisseDuJourCash,
        caisseDuJourMobile,
        caisseDuJourCredit,
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
    } = useRetailDashboardStats(selectedBusiness);

    const cashTrend = describeDayTrend({
        today: caisseDuJour,
        yesterdaySoFar: caisseHier,
        format: (value) => `${formatFCFA(value)}\u00A0FCFA`,
    });
    const transactionsTrend = describeDayTrend({
        today: transactions,
        yesterdaySoFar: transactionsHier,
        mode: 'difference',
        format: (count) => `${count} vente${count > 1 ? 's' : ''}`,
    });

    const openRestockList = () => navigate(`/dashboard/stock?filtre=${RESTOCK_FILTER}`);
    const nearlyEmptyCount = alertesStock - outOfStockCount;
    // Les ruptures d'abord (lowStockProducts est déjà trié par urgence) : ce
    // sont elles qui font perdre des ventes aujourd'hui.
    const firstNames = lowStockProducts.slice(0, 3).map((p) => p.name);

    return (
        <div className="space-y-10 animate-fade-in-up pb-10">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-bold text-primary mb-1 tracking-tight">Bonjour, voici l'aperçu du jour</h1>
                    <p className="text-secondary text-sm font-medium">
                        {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {selectedBusiness?.name}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/dashboard/caisse')}
                        className="btn-primary text-sm shadow-premium-lg"
                    >
                        + Nouvelle vente
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center gap-4 mb-4 relative">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <DollarSign className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Ventes du jour</p>
                            <h3 className="text-2xl font-bold text-primary">{formatFCFA(caisseDuJour)}&nbsp;<span className="text-sm font-medium">FCFA</span></h3>
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <DayTrend trend={cashTrend} />
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-border-theme/50 flex justify-between text-xs relative gap-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Espèces</span>
                            <span className="font-bold text-primary">{formatFCFA(caisseDuJourCash)}&nbsp;FCFA</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>Mobile</span>
                            <span className="font-bold text-primary">{formatFCFA(caisseDuJourMobile)}&nbsp;FCFA</span>
                        </div>
                        {caisseDuJourMoyenInconnu > 0 && (
                            <div className="flex flex-col gap-0.5" title="Dettes remboursées aujourd'hui sans moyen de paiement enregistré — comptées comme encaissées, mais impossible de dire si c'est en espèces ou par Mobile Money">
                                <span className="text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Moyen inconnu</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatFCFA(caisseDuJourMoyenInconnu)}&nbsp;FCFA</span>
                            </div>
                        )}
                        {caisseDuJourCredit > 0 && (
                            <div className="flex flex-col gap-0.5 text-right" title="Vendu à crédit aujourd'hui — pas encore encaissé, voir Dettes">
                                <span className="text-slate-400 flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Crédit</span>
                                <span className="font-bold text-purple-600 dark:text-purple-400">{formatFCFA(caisseDuJourCredit)}&nbsp;FCFA</span>
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <ShoppingCart className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Transactions</p>
                            <h3 className="text-2xl font-bold text-primary">{transactions}</h3>
                        </div>
                    </div>
                    <DayTrend trend={transactionsTrend} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <CreditCard className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Panier Moyen</p>
                            <h3 className="text-2xl font-bold text-primary">{formatFCFA(panierMoyen)}&nbsp;<span className="text-sm font-medium">FCFA</span></h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                        Dépense moyenne par client
                    </div>
                </motion.div>

                {/* Toute la carte est un bouton : un doigt qui tape n'importe où dessus
                    ouvre directement la liste filtrée des articles à commander, au lieu
                    d'un stock complet où il faudrait les rechercher un par un. */}
                <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={openRestockList}
                    aria-label={alertesStock > 0
                        ? `${alertesStock} articles à réapprovisionner, dont ${outOfStockCount} en rupture. Voir la liste.`
                        : 'Stock sain. Voir le stock.'}
                    className={`text-left w-full bg-panel rounded-3xl p-6 shadow-premium border ${alertesStock > 0 ? 'border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 hover:border-red-300' : 'border-slate-100 dark:border-border-theme hover:border-accent/30'} relative overflow-hidden group cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
                >
                    <div className="flex items-center gap-4 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${alertesStock > 0 ? 'bg-red-100 text-red-500' : 'bg-slate-50 dark:bg-slate-800 text-amber-500'}`}>
                            {alertesStock > 0 ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                        </div>
                        <div className="min-w-0">
                            <p className={`text-sm font-medium ${alertesStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-secondary'}`}>
                                À réapprovisionner
                            </p>
                            <h3 className={`text-2xl font-bold ${alertesStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>
                                {alertesStock}
                            </h3>
                        </div>
                    </div>
                    {alertesStock > 0 ? (
                        <>
                            {/* Les chiffres d'abord : ils tiennent toujours sur la carte,
                                contrairement à une liste de noms qu'il fallait couper. */}
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                {outOfStockCount > 0 && <>{outOfStockCount} en rupture</>}
                                {outOfStockCount > 0 && nearlyEmptyCount > 0 && ' · '}
                                {nearlyEmptyCount > 0 && <>{nearlyEmptyCount} presque vide{nearlyEmptyCount > 1 ? 's' : ''}</>}
                            </p>
                            <ul className="mt-1.5 space-y-0.5">
                                {firstNames.map((name) => (
                                    <li key={name} className="text-xs text-red-600/80 dark:text-red-400/80 truncate">{name}</li>
                                ))}
                            </ul>
                            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-red-700 dark:text-red-400">
                                {alertesStock > firstNames.length ? `Voir les ${alertesStock} articles` : 'Voir la liste'}
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </p>
                        </>
                    ) : (
                        <p className="text-sm font-medium text-slate-400">Stock sain</p>
                    )}
                </motion.button>

            </div>

            {/* Bottom Section: Chart & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart */}
                <div className="lg:col-span-2 bg-panel rounded-3xl p-8 shadow-premium">
                    <div className="flex justify-between items-start mb-8">
                        <h2 className="text-lg font-bold text-primary">Ventes des 7 derniers jours</h2>
                        <div className="text-right">
                            <p className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Total</p>
                            <p className="text-primary font-bold">{formatFCFA(total7Days)} FCFA</p>
                        </div>
                    </div>

                    <div className="h-[250px] w-full">
                        {loadingSales ? (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">Chargement...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#F9FAFB' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
                                        formatter={(value) => [`${formatFCFA(value)} FCFA`, 'Ventes']}
                                    />
                                    <Bar dataKey="total" radius={[6, 6, 6, 6]} barSize={40}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.total === Math.max(...chartData.map(d => d.total)) && entry.total > 0 ? '#C25637' : '#E8B6A6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-panel rounded-3xl p-8 shadow-premium">
                    <h2 className="text-lg font-bold text-primary mb-8">Produits les plus vendus</h2>

                    <div className="space-y-6">
                        {loadingSales ? (
                            <p className="text-sm text-secondary">Chargement...</p>
                        ) : topProducts.length === 0 ? (
                            <p className="text-sm text-secondary">Aucune donnée disponible.</p>
                        ) : (
                            topProducts.map((product, index) => {
                                    const Icon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + (index * 0.1) }}
                                            key={product.name}
                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">{Icon}</div>
                                                <div>
                                                    <p className="font-bold text-primary">{product.name}</p>
                                                    <p className="text-xs text-secondary">{product.quantity} vendus</p>
                                                </div>
                                            </div>
                                            <div className="font-bold text-accent">
                                                {formatFCFA(product.revenue)}&nbsp;FCFA
                                            </div>
                                        </motion.div>
                                    );
                            })
                        )}
                    </div>
                </div>

            </div>

            <AddProductModal
                isOpen={isAddProductOpen}
                onClose={() => setIsAddProductOpen(false)}
            />
        </div>
    );
};
