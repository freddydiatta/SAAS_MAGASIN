import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../../contexts/BusinessContext';
import { useFinances } from '../../hooks/useFinances';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, Wallet, TrendingUp, TrendingDown, HandCoins, Package } from 'lucide-react';
import { motion } from 'framer-motion';

export const Finances = () => {
    const { selectedBusiness } = useBusiness();
    const navigate = useNavigate();
    const {
        isLoading,
        totalRevenue,
        netProfit,
        revenueThisMonth,
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
    } = useFinances(selectedBusiness);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-10">
            <div>
                <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Finances</h1>
                <p className="text-secondary text-sm">Ce que vous avez réellement gagné, au-delà de la caisse du jour.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Chiffre d'affaires total</p>
                    </div>
                    <h3 className="text-2xl font-bold text-primary">{isLoading ? '…' : formatFCFA(totalRevenue)} <span className="text-sm font-medium">F</span></h3>
                    <p className="text-xs text-slate-400 mt-1">Argent réellement encaissé, depuis le début</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-emerald-500">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Bénéfice net total</p>
                    </div>
                    <h3 className={`text-2xl font-bold ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {isLoading ? '…' : formatFCFA(netProfit)} <span className="text-sm font-medium">F</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Chiffre d'affaires moins les dépenses</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-blue-500">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Ce mois-ci</p>
                    </div>
                    <h3 className="text-2xl font-bold text-primary">{isLoading ? '…' : formatFCFA(revenueThisMonth)} <span className="text-sm font-medium">F</span></h3>
                    <div className="flex items-center gap-1 text-xs mt-1">
                        <span className={`flex items-center gap-1 font-bold ${percentChangeMonth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {percentChangeMonth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {percentChangeMonth > 0 ? '+' : ''}{percentChangeMonth}%
                        </span>
                        <span className="text-slate-400">vs mois dernier</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Bénéfice du mois : {formatFCFA(profitThisMonth)} F</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => navigate('/dashboard/dettes')}
                    className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme cursor-pointer hover:border-accent/30 transition-colors"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <HandCoins className="w-6 h-6" />
                        </div>
                        <p className="text-secondary text-sm font-medium">Dettes en attente</p>
                    </div>
                    <h3 className="text-2xl font-bold text-primary">{isLoading ? '…' : formatFCFA(pendingDebtsTotal)} <span className="text-sm font-medium">F</span></h3>
                    <p className="text-xs text-slate-400 mt-1">Pas encore compté dans le chiffre d'affaires</p>
                </motion.div>
            </div>

            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-primary">Si vous vendez tout votre stock</h2>
                        <p className="text-xs text-secondary">Ce que rapporterait le stock restant, en plus de ce qui est déjà gagné.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                    <div>
                        <p className="text-secondary text-sm font-medium mb-1">Valeur de vente du stock</p>
                        <p className="text-xl font-bold text-primary">{isLoading ? '…' : formatFCFA(stockSaleValue)} F</p>
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium mb-1">Coût du stock</p>
                        <p className="text-xl font-bold text-primary">{isLoading ? '…' : formatFCFA(stockCost)} F</p>
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium mb-1">Bénéfice potentiel</p>
                        <p className={`text-xl font-bold ${stockPotentialProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {isLoading ? '…' : formatFCFA(stockPotentialProfit)} F
                        </p>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-secondary font-medium">Bénéfice total si vous vendez tout</span>
                    <span className={`text-2xl font-bold ${projectedTotalProfit >= 0 ? 'text-accent' : 'text-red-500'}`}>
                        {isLoading ? '…' : formatFCFA(projectedTotalProfit)} F
                    </span>
                </div>

                {productsWithoutCostPriceCount > 0 && (
                    <div className="text-xs text-slate-400 mt-4">
                        <p className="mb-2">
                            {productsWithoutCostPriceCount} produit{productsWithoutCostPriceCount > 1 ? 's' : ''} sans prix d'achat renseigné, non compté{productsWithoutCostPriceCount > 1 ? 's' : ''} dans le coût ni le bénéfice potentiel du stock :
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {productsWithoutCostPrice.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => navigate(`/dashboard/stock?q=${encodeURIComponent(product.name)}`)}
                                    className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                                >
                                    {product.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-panel rounded-3xl p-8 shadow-premium border border-slate-100 dark:border-border-theme">
                <h2 className="text-lg font-bold text-primary mb-6">Revenus et dépenses — 6 derniers mois</h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
                                formatter={(value) => `${Number(value).toLocaleString('fr-FR')} FCFA`}
                            />
                            <Legend />
                            <Bar dataKey="revenue" name="Revenus" fill="#10B981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="expenses" name="Dépenses" fill="#D96645" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
