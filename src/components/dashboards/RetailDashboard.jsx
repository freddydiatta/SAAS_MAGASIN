import { useBusiness } from '../../contexts/BusinessContext';
import { useRetailDashboardStats } from '../../hooks/useRetailDashboardStats';
import { AddProductModal } from '../AddProductModal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, ShoppingCart, AlertTriangle, TrendingUp, TrendingDown, Package, CreditCard, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

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
    } = useRetailDashboardStats(selectedBusiness);

    return (
        <div className="space-y-10 animate-fade-in-up pb-10">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-bold text-primary mb-1 tracking-tight">Bonjour, voici l'aperçu du jour</h1>
                    <p className="text-secondary text-sm font-medium">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {selectedBusiness?.name}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                            <p className="text-secondary text-sm font-medium">Caisse du jour</p>
                            <h3 className="text-2xl font-bold text-primary">{formatFCFA(caisseDuJour)} <span className="text-sm font-medium">F</span></h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm relative mb-3">
                        <span className={`flex items-center gap-1 font-bold ${percentChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {percentChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {percentChange > 0 ? '+' : ''}{percentChange}%
                        </span>
                        <span className="text-slate-400 font-medium">vs hier</span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-border-theme/50 flex justify-between text-xs relative gap-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Espèces</span>
                            <span className="font-bold text-primary">{formatFCFA(caisseDuJourCash)} F</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>Mobile</span>
                            <span className="font-bold text-primary">{formatFCFA(caisseDuJourMobile)} F</span>
                        </div>
                        {caisseDuJourRembourse > 0 && (
                            <div className="flex flex-col gap-0.5" title="Dettes remboursées aujourd'hui — comptées comme encaissées">
                                <span className="text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Remboursements</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatFCFA(caisseDuJourRembourse)} F</span>
                            </div>
                        )}
                        {caisseDuJourCredit > 0 && (
                            <div className="flex flex-col gap-0.5 text-right" title="Vendu à crédit aujourd'hui — pas encore encaissé, voir Dettes">
                                <span className="text-slate-400 flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Crédit</span>
                                <span className="font-bold text-purple-600 dark:text-purple-400">{formatFCFA(caisseDuJourCredit)} F</span>
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
                    <div className="flex items-center gap-2 text-sm">
                        <span className={`flex items-center gap-1 font-bold ${diffTransactions >= 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {diffTransactions > 0 ? '+' : ''}{diffTransactions}
                        </span>
                        <span className="text-slate-400 font-medium">vs hier</span>
                    </div>
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
                            <h3 className="text-2xl font-bold text-primary">{formatFCFA(panierMoyen)} <span className="text-sm font-medium">F</span></h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                        Dépense moyenne par client
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={alertesStock > 0 ? () => navigate('/dashboard/stock') : undefined}
                    className={`bg-panel rounded-3xl p-6 shadow-premium border ${alertesStock > 0 ? 'border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 cursor-pointer' : 'border-slate-100 dark:border-border-theme'} relative overflow-hidden group`}
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${alertesStock > 0 ? 'bg-red-100 text-red-500' : 'bg-slate-50 dark:bg-slate-800 text-amber-500'}`}>
                            {alertesStock > 0 ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${alertesStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-secondary'}`}>
                                Alertes Stock
                            </p>
                            <h3 className={`text-2xl font-bold ${alertesStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>
                                {alertesStock}
                            </h3>
                        </div>
                    </div>
                    {alertesStock > 0 ? (
                        <div className="text-sm font-medium text-red-500 truncate">
                            {lowStockProducts.slice(0, 2).map(p => p.name).join(', ')}
                            {lowStockProducts.length > 2 ? ` +${lowStockProducts.length - 2} autre${lowStockProducts.length - 2 > 1 ? 's' : ''}` : ''}
                        </div>
                    ) : (
                        <div className="text-sm font-medium text-slate-400">Stock sain</div>
                    )}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => navigate('/dashboard/depenses')}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme relative overflow-hidden group hover:border-accent/30 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Wallet className={`w-6 h-6 ${beneficeDuJour >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">Bénéfice net (jour)</p>
                            <h3 className={`text-2xl font-bold ${beneficeDuJour >= 0 ? 'text-primary' : 'text-red-500'}`}>{formatFCFA(beneficeDuJour)} <span className="text-sm font-medium">F</span></h3>
                        </div>
                    </div>
                    <div className="text-sm font-medium text-slate-400">
                        Dépenses : {formatFCFA(depensesDuJour)} F
                    </div>
                </motion.div>
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
                                                {formatFCFA(product.revenue)} F
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
