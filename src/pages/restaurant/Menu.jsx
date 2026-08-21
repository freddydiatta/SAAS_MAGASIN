import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { Plus, X, Utensils, Coffee, Pizza, IceCream } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/Modal';

export const Menu = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', price: '', category: 'plat' });

    const { data: menuItems = [], isLoading } = useQuery({
        queryKey: ['menuItems', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('menu_items')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('category')
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const addMenuItemMutation = useMutation({
        mutationFn: async (newItem) => {
            const { data, error } = await supabase
                .from('menu_items')
                .insert([{ ...newItem, business_id: selectedBusiness.id }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['menuItems']);
            setIsAddOpen(false);
            setFormData({ name: '', price: '', category: 'plat' });
            toast.success('Plat ajouté au menu !');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        addMenuItemMutation.mutate({
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            is_available: true
        });
    };

    const categories = {
        'entree': 'Entrées',
        'plat': 'Plats',
        'dessert': 'Desserts',
        'boisson': 'Boissons'
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Le Menu</h1>
                    <p className="text-secondary text-sm">Gérez les plats et boissons de votre restaurant.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsAddOpen(true)}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-premium"
                    >
                        <Plus className="w-5 h-5" /> Ajouter au Menu
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(categories).map(([key, label], index) => {
                    const items = menuItems.filter(i => i.category === key);
                    const CategoryIcon = key === 'entree' ? Utensils : key === 'plat' ? Pizza : key === 'dessert' ? IceCream : Coffee;
                    return (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            key={key} 
                            className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme flex flex-col h-full group hover:border-accent/30 transition-colors"
                        >
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-border-theme">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <CategoryIcon className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold text-primary">{label}</h2>
                            </div>
                            <div className="flex-1 space-y-4">
                                {items.length === 0 ? (
                                    <p className="text-sm text-slate-400 dark:text-slate-500 italic text-center py-4">Aucun élément</p>
                                ) : (
                                    items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center group/item hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 -mx-2 rounded-lg transition-colors">
                                            <div>
                                                <p className="font-medium text-primary text-sm group-hover/item:text-accent transition-colors">{item.name}</p>
                                                <p className="text-xs text-secondary font-bold">{item.price.toLocaleString('fr-FR')} F</p>
                                            </div>
                                            <div className={`w-3 h-3 rounded-full ${item.is_available ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} title={item.is_available ? 'Disponible' : 'Indisponible'}></div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Modal for adding Menu Item */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                panelClassName="bg-panel rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-border-theme"
            >
                <div className="px-6 py-4 border-b border-slate-100 dark:border-border-theme flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <h2 className="text-xl font-bold text-primary">Ajouter au Menu</h2>
                    <button onClick={() => setIsAddOpen(false)} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1">Nom (Plat, Boisson...)</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                            placeholder="Ex: Poulet Yassa"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-primary mb-1">Catégorie</label>
                            <select
                                className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                            >
                                <option value="entree">Entrée</option>
                                <option value="plat">Plat</option>
                                <option value="dessert">Dessert</option>
                                <option value="boisson">Boisson</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary mb-1">Prix (FCFA)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                                placeholder="Ex: 3500"
                                value={formData.price}
                                onChange={e => setFormData({...formData, price: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="pt-4">
                        <button type="submit" disabled={addMenuItemMutation.isPending} className="btn-primary w-full py-3 text-base shadow-premium">
                            {addMenuItemMutation.isPending ? 'Ajout...' : 'Ajouter au menu'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
