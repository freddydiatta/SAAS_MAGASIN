import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { AddProductModal } from '../AddProductModal';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

    // Fetch Sales
    const { data: sales = [], isLoading: loadingSales } = useQuery({
        queryKey: ['sales', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales')
                .select('*, products(name, type)')
                .eq('business_id', selectedBusiness?.id)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!selectedBusiness
    });

    // Calculs KPI
    const today = new Date().setHours(0,0,0,0);
    const caisseDuJour = sales
        .filter(sale => new Date(sale.created_at).getTime() >= today)
        .reduce((sum, sale) => sum + Number(sale.total_price), 0);

    const alertesStock = products.filter(p => p.stock_quantity <= 2).length;
    
    // Format monétaire
    const formatFCFA = (amount) => {
        return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Aperçu du Jour</h1>
                    <p className="text-secondary text-sm">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/dashboard/caisse')} className="btn-secondary bg-white px-5 py-2.5 text-sm border border-slate-200 text-primary">Ajouter une vente</button>
                    <button 
                        onClick={() => setIsAddProductOpen(true)}
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        + Ajouter Produit
                    </button>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl mb-4">
                        💵
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Caisse du Jour</p>
                    <p className="text-3xl font-bold text-primary mb-2">
                        {loadingSales ? "..." : formatFCFA(caisseDuJour)}
                    </p>
                    <p className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                        Total des ventes d'aujourd'hui
                    </p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl mb-4">
                        📦
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Total Articles en Stock</p>
                    <p className="text-3xl font-bold text-primary mb-2">
                        {loadingProducts ? "..." : products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0)}
                    </p>
                    <p className="text-secondary font-medium text-xs">
                        Répartis sur {products.length} références
                    </p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative border-t-4 border-amber-500">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl mb-4">
                        ⚠️
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Alertes Stock</p>
                    <p className="text-3xl font-bold text-primary mb-2">
                        {loadingProducts ? "..." : alertesStock}
                    </p>
                    <p className="text-secondary font-medium text-xs">Articles à recommander (Qté ≤ 2)</p>
                </div>

                {/* KPI 4 */}
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl mb-4">
                        📈
                    </div>
                    <p className="text-secondary text-sm font-medium mb-1">Ventes Totales</p>
                    <p className="text-3xl font-bold text-primary mb-2">
                        {loadingSales ? "..." : sales.length}
                    </p>
                    <p className="text-secondary font-medium text-xs">Historique complet</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Dernières Transactions */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-premium overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-primary">Dernières Ventes</h2>
                        <button className="text-accent font-medium text-sm hover:text-accentHover transition-colors">Tout voir</button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider">Date</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider">Article</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider">Qté</th>
                                    <th className="py-3 px-6 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingSales ? (
                                    <tr><td colSpan="4" className="py-4 text-center text-secondary">Chargement des ventes...</td></tr>
                                ) : sales.length === 0 ? (
                                    <tr><td colSpan="4" className="py-8 text-center text-secondary">Aucune vente enregistrée pour le moment.</td></tr>
                                ) : sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-sm text-secondary">
                                            {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="py-4 px-6 text-sm font-medium text-primary">
                                            <span className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${
                                                    sale.products?.type === 'moto' ? 'bg-blue-500' : 
                                                    sale.products?.type === 'villa' ? 'bg-indigo-500' : 'bg-emerald-500'
                                                }`}></span>
                                                {sale.products?.name || 'Produit inconnu'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-secondary">{sale.quantity}</td>
                                        <td className="py-4 px-6 text-sm font-bold text-primary text-right">
                                            {formatFCFA(sale.total_price)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Alertes Stock (Dynamique) */}
                <div className="bg-white rounded-2xl shadow-premium flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                        {alertesStock > 0 && (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        )}
                        <h2 className="text-lg font-bold text-primary">Ruptures de Stock</h2>
                    </div>

                    <div className="p-6 space-y-4 flex-1 bg-slate-50/50">
                        {loadingProducts ? (
                            <p className="text-secondary text-sm">Vérification des stocks...</p>
                        ) : alertesStock === 0 ? (
                            <div className="text-center py-6">
                                <div className="text-4xl mb-2">✅</div>
                                <p className="text-secondary font-medium text-sm">Tous vos stocks sont au beau fixe !</p>
                            </div>
                        ) : (
                            products.filter(p => p.stock_quantity <= 2).map(product => (
                                <div key={product.id} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500"></div>
                                    <p className="font-bold text-primary text-sm mb-1">{product.name}</p>
                                    <p className="text-secondary text-xs mb-3">Plus que {product.stock_quantity} en stock</p>
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
