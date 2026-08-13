import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

export const Villas = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', address: '', price_per_night: '' });

    const { data: villas = [], isLoading } = useQuery({
        queryKey: ['villas', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('villas')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const addVillaMutation = useMutation({
        mutationFn: async (newVilla) => {
            const { data, error } = await supabase
                .from('villas')
                .insert([{ ...newVilla, business_id: selectedBusiness.id }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['villas']);
            setIsAddOpen(false);
            setFormData({ name: '', address: '', price_per_night: '' });
            alert('Villa ajoutée avec succès !');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        addVillaMutation.mutate({
            name: formData.name,
            address: formData.address,
            price_per_night: parseFloat(formData.price_per_night)
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Vos Biens & Villas</h1>
                    <p className="text-secondary text-sm">Gérez les propriétés que vous louez.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsAddOpen(true)}
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        + Ajouter une Villa
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <p className="text-secondary py-8">Chargement...</p>
                ) : villas.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300">
                        <p className="text-secondary">Aucun bien trouvé. Ajoutez votre première villa !</p>
                    </div>
                ) : (
                    villas.map(villa => (
                        <div key={villa.id} className="bg-white rounded-3xl p-6 shadow-premium border border-slate-100 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-primary">{villa.name}</h3>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    villa.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {villa.status === 'available' ? 'Disponible' : 'En maintenance'}
                                </span>
                            </div>
                            <p className="text-secondary text-sm mb-4 flex-1">📍 {villa.address || 'Aucune adresse renseignée'}</p>
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-secondary text-sm">Prix / Nuit</span>
                                <span className="font-bold text-indigo-600 text-lg">{villa.price_per_night.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for adding a Villa */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-primary">Ajouter un bien</h2>
                            <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">Nom du bien / Villa</label>
                                <input 
                                    type="text" 
                                    required
                                    className="input-field" 
                                    placeholder="Ex: Villa Saly Vue Mer"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">Adresse</label>
                                <input 
                                    type="text" 
                                    className="input-field" 
                                    placeholder="Ex: Quartier Ngaparou"
                                    value={formData.address}
                                    onChange={e => setFormData({...formData, address: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">Prix par Nuit (FCFA)</label>
                                <input 
                                    type="number" 
                                    required
                                    min="0"
                                    className="input-field" 
                                    placeholder="Ex: 150000"
                                    value={formData.price_per_night}
                                    onChange={e => setFormData({...formData, price_per_night: e.target.value})}
                                />
                            </div>
                            <div className="pt-4">
                                <button type="submit" disabled={addVillaMutation.isPending} className="btn-primary w-full py-3">
                                    {addVillaMutation.isPending ? 'Ajout en cours...' : 'Enregistrer le bien'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
