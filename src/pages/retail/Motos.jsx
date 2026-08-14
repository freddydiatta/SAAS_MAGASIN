import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { Plus, Search, Edit2, Bike, Tag, Settings, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export const Motos = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    // For a real app, you would have Modals for Add/Edit Moto, using the AddProductModal or a specific one.

    const { data: motos = [], isLoading } = useQuery({
        queryKey: ['motos', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .or('type.eq.moto,name.ilike.%moto%') // Just as an example filter
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const filteredMotos = motos.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-primary mb-2 flex items-center gap-3">
                        <Bike className="w-8 h-8 text-accent" />
                        Parc Motos
                    </h1>
                    <p className="text-secondary font-medium">Gérez votre inventaire de deux-roues (Disponibilité, Prix).</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-premium"
                        onClick={() => toast.success("Fonctionnalité d'ajout de moto (Modal) à venir")}
                    >
                        <Plus className="w-5 h-5" /> Nouvelle Moto
                    </button>
                </div>
            </div>

            {/* Content */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden"
            >
                <div className="p-6 border-b border-slate-100 dark:border-border-theme relative flex items-center">
                    <div className="relative w-full max-w-md">
                        <input 
                            type="text" 
                            placeholder="Rechercher une moto (Modèle, Marque)..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-full py-3 px-5 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary placeholder:text-slate-400"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-10 flex justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent"></div>
                        </div>
                    ) : filteredMotos.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bike className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-secondary font-medium">Aucune moto trouvée dans le parc.</p>
                            <button className="mt-4 text-accent font-medium hover:underline text-sm">
                                Ajoutez votre première moto
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-secondary text-xs uppercase tracking-wider">
                                    <th className="p-4 font-semibold border-b border-slate-100 dark:border-border-theme">Modèle</th>
                                    <th className="p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-center">Quantité (Stock)</th>
                                    <th className="p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-right">Prix Unitaire</th>
                                    <th className="p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-center">Statut</th>
                                    <th className="p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMotos.map((moto) => (
                                    <tr key={moto.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-50 dark:border-border-theme/50 last:border-0 group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                    <Bike className="w-5 h-5 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-primary">{moto.name}</p>
                                                    <p className="text-xs text-secondary flex items-center gap-1">
                                                        <Tag className="w-3 h-3" /> Moto
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${moto.stock_quantity > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                {moto.stock_quantity}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-accent">
                                                {Number(moto.price).toLocaleString('fr-FR')} FCFA
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {moto.stock_quantity > 0 ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                                    Disponible
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                                                    Rupture
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
