import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { AddProductModal } from '../AddProductModal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, ShoppingCart, AlertTriangle, TrendingUp, TrendingDown, Package, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

export const RetailDashboard = () => {
    const { user } = useAuth();
    const { selectedBusiness } = useBusiness();
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const navigate = useNavigate();

    // Fetch Products (Stock)
    const { data: products = [], isLoading: loadingProducts } = useQuery({
        queryKey: ['products', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!selectedBusiness
    });

    // Fetch Sales (Last 30 days for better stats)
    const { data: sales = [], isLoading: loadingSales } = useQuery({
        queryKey: ['sales', selectedBusiness?.id],
        queryFn: async () => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { data, error } = await supabase
                .from('sales')
                .select('*, products(name, type), receipts!inner(status)')
                .eq('business_id', selectedBusiness?.id)
                .eq('receipts.status', 'completed')
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!selectedBusiness
    });

    // --- KPI Calculations ---
    const today = new Date().setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const salesToday = sales.filter(s => new Date(s.created_at).getTime() >= today);
    const salesYesterday = sales.filter(s => {
        const time = new Date(s.created_at).getTime();
        return time >= yesterday.getTime() && time < today;
    });

    const caisseDuJour = salesToday.reduce((sum, sale) => sum + Number(sale.total_price), 0);
    const caisseHier = salesYesterday.reduce((sum, sale) => sum + Number(sale.total_price), 0);
    
    // Calculate % change (prevent divide by zero)
    const percentChange = caisseHier > 0 
        ? Math.round(((caisseDuJour - caisseHier) / caisseHier) * 100) 
        : (caisseDuJour > 0 ? 100 : 0);

    const panierMoyen = salesToday.length > 0 ? Math.round(caisseDuJour / salesToday.length) : 0;
    const transactions = salesToday.length;
    
    const transactionsHier = salesYesterday.length;
    const diffTransactions = transactions - transactionsHier;

    const alertesStock = products.filter(p => p.stock_quantity <= 2).length;

    // --- Chart Data (Last 7 Days) ---
    const chartData = [];
    let total7Days = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0,0,0,0);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);
        
        const daySales = sales.filter(s => {
            const time = new Date(s.created_at).getTime();
            return time >= d.getTime() && time < nextD.getTime();
        });
        
        const dayTotal = daySales.reduce((sum, s) => sum + Number(s.total_price), 0);
        total7Days += dayTotal;
        
        chartData.push({
            name: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
            total: dayTotal
        });
    }

    // --- Top Products ---
    const productStats = {};
    sales.forEach(sale => {
        const name = sale.products?.name || 'Inconnu';
        if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 };
        productStats[name].quantity += sale.quantity;
        productStats[name].revenue += Number(sale.total_price);
    });
    
    const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3);

    // Format monétaire
    const formatFCFA = (amount) => {
        return new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ');
    };

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <div className="flex items-center gap-2 text-sm relative">
                        <span className={`flex items-center gap-1 font-bold ${percentChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {percentChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {percentChange > 0 ? '+' : ''}{percentChange}%
                        </span>
                        <span className="text-slate-400 font-medium">vs hier</span>
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
                    className={`bg-panel rounded-3xl p-6 shadow-premium border ${alertesStock > 0 ? 'border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-100 dark:border-border-theme'} relative overflow-hidden group`}
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
                    <div className={`text-sm font-medium ${alertesStock > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {alertesStock > 0 ? 'Articles à réapprovisionner' : 'Stock sain'}
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
