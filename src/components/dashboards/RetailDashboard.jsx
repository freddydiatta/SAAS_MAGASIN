import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { AddProductModal } from '../AddProductModal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1 */}
                <div className="bg-panel rounded-3xl p-6 shadow-premium transition-transform hover:-translate-y-1 duration-300">
                    <p className="text-secondary text-sm font-medium mb-4">Ventes du jour</p>
                    <div className="flex items-end gap-2 mb-4">
                        <p className="text-[32px] font-bold text-primary leading-none">
                            {loadingSales ? "..." : formatFCFA(caisseDuJour)}
                        </p>
                    </div>
                    <p className="text-secondary font-medium text-xs">FCFA</p>
                    <p className={`font-bold text-xs mt-3 ${percentChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {percentChange > 0 ? '↑' : percentChange < 0 ? '↓' : ''} {Math.abs(percentChange)}% vs hier
                    </p>
                </div>

                {/* KPI 2 */}
                <div className="bg-panel rounded-3xl p-6 shadow-premium transition-transform hover:-translate-y-1 duration-300">
                    <p className="text-secondary text-sm font-medium mb-4">Panier moyen</p>
                    <div className="flex items-end gap-2 mb-4">
                        <p className="text-[32px] font-bold text-primary leading-none">
                            {loadingSales ? "..." : formatFCFA(panierMoyen)}
                        </p>
                    </div>
                    <p className="text-secondary font-medium text-xs">FCFA</p>
                    <p className="text-slate-400 font-bold text-xs mt-3">
                        Stable
                    </p>
                </div>

                {/* KPI 3 */}
                <div className="bg-panel rounded-3xl p-6 shadow-premium transition-transform hover:-translate-y-1 duration-300">
                    <p className="text-secondary text-sm font-medium mb-4">Transactions</p>
                    <div className="flex items-end gap-2 mb-4">
                        <p className="text-[32px] font-bold text-primary leading-none">
                            {loadingSales ? "..." : transactions}
                        </p>
                    </div>
                    <p className="text-secondary font-medium text-xs invisible">.</p>
                    <p className={`font-bold text-xs mt-3 ${diffTransactions >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {diffTransactions > 0 ? '↑' : diffTransactions < 0 ? '↓' : ''} {Math.abs(diffTransactions)} vs hier
                    </p>
                </div>

                {/* KPI 4 */}
                <div className="bg-panel rounded-3xl p-6 shadow-premium transition-transform hover:-translate-y-1 duration-300">
                    <p className="text-secondary text-sm font-medium mb-4">Alertes stock bas</p>
                    <div className="flex items-end gap-2 mb-4">
                        <p className={`text-[32px] font-bold leading-none ${alertesStock > 0 ? 'text-rose-500' : 'text-primary'}`}>
                            {loadingProducts ? "..." : alertesStock}
                        </p>
                        <span className="text-secondary text-sm font-medium mb-1 ml-1">articles</span>
                    </div>
                    <p className="text-secondary font-medium text-xs invisible">.</p>
                    <p className="text-rose-500 font-bold text-xs mt-3 uppercase tracking-wider">
                        À réapprovisionner
                    </p>
                </div>
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
                            topProducts.map((product, index) => (
                                <div key={index} className="flex justify-between items-center group">
                                    <div>
                                        <p className="font-bold text-primary text-sm group-hover:text-accent transition-colors">{product.name}</p>
                                        <p className="text-xs text-secondary mt-1">{product.quantity} ventes</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-primary font-medium">{formatFCFA(product.revenue)}</p>
                                    </div>
                                </div>
                            ))
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
