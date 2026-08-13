import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

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
            alert('Plat ajouté au menu !');
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
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        + Ajouter au Menu
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(categories).map(([key, label]) => {
                    const items = menuItems.filter(i => i.category === key);
                    return (
                        <div key={key} className="bg-white rounded-3xl p-6 shadow-premium border border-slate-100 flex flex-col h-full">
                            <h2 className="text-xl font-bold text-primary mb-4 pb-2 border-b border-slate-100">{label}</h2>
                            <div className="flex-1 space-y-4">
                                {items.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">Aucun élément</p>
                                ) : (
                                    items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center group">
                                            <div>
                                                <p className="font-medium text-primary text-sm">{item.name}</p>
                                                <p className="text-xs text-indigo-600 font-bold">{item.price.toLocaleString()} F</p>
                                            </div>
                                            <div className={`w-3 h-3 rounded-full ${item.is_available ? 'bg-emerald-500' : 'bg-red-500'}`} title={item.is_available ? 'Disponible' : 'Indisponible'}></div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal for adding Menu Item */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-primary">Ajouter au Menu</h2>
                            <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">Nom (Plat, Boisson...)</label>
                                <input 
                                    type="text" 
                                    required
                                    className="input-field" 
                                    placeholder="Ex: Poulet Yassa"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-1">Catégorie</label>
                                    <select 
                                        className="input-field"
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
                                        className="input-field" 
                                        placeholder="Ex: 3500"
                                        value={formData.price}
                                        onChange={e => setFormData({...formData, price: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="pt-4">
                                <button type="submit" disabled={addMenuItemMutation.isPending} className="btn-primary w-full py-3">
                                    {addMenuItemMutation.isPending ? 'Ajout...' : 'Ajouter au menu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
