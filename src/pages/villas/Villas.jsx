import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { Home, MapPin, Plus, X, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/Modal';
import { villaSchema, firstZodError } from '../../lib/validation';
import { StatusBadge } from '../../components/StatusBadge';

export const Villas = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingVilla, setEditingVilla] = useState(null);
    const [formData, setFormData] = useState({ name: '', address: '', price_per_night: '' });
    const [formError, setFormError] = useState('');

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
            toast.success('Villa ajoutée avec succès !');
        }
    });

    const updateVillaMutation = useMutation({
        mutationFn: async ({ id, ...updates }) => {
            const { data, error } = await supabase
                .from('villas')
                .update(updates)
                .eq('id', id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['villas']);
            setIsAddOpen(false);
            setEditingVilla(null);
            setFormData({ name: '', address: '', price_per_night: '' });
            toast.success('Villa modifiée avec succès !');
        }
    });

    const deleteVillaMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('villas')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['villas']);
            toast.success('Villa supprimée avec succès !');
        },
        onError: () => {
            toast.error('Erreur lors de la suppression. Cette villa a peut-être des réservations.');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');

        const result = villaSchema.safeParse(formData);
        if (!result.success) {
            setFormError(firstZodError(result));
            return;
        }

        if (editingVilla) {
            updateVillaMutation.mutate({ id: editingVilla.id, ...result.data });
        } else {
            addVillaMutation.mutate(result.data);
        }
    };

    const handleEdit = (villa) => {
        setEditingVilla(villa);
        setFormData({
            name: villa.name,
            address: villa.address || '',
            price_per_night: villa.price_per_night
        });
        setFormError('');
        setIsAddOpen(true);
    };

    const handleDelete = (villa) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer la villa "${villa.name}" ?`)) {
            deleteVillaMutation.mutate(villa.id);
        }
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
                        onClick={() => {
                            setEditingVilla(null);
                            setFormData({ name: '', address: '', price_per_night: '' });
                            setFormError('');
                            setIsAddOpen(true);
                        }}
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        + Ajouter une Villa
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent"></div>
                    </div>
                ) : villas.length === 0 ? (
                    <div className="col-span-full text-center py-16 bg-panel rounded-3xl border border-dashed border-slate-300 dark:border-border-theme">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Home className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-secondary font-medium">Aucun bien trouvé. Ajoutez votre première villa !</p>
                    </div>
                ) : (
                    villas.map((villa, index) => (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            key={villa.id} 
                            className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme flex flex-col group hover:border-accent/30 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                        <Home className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary group-hover:text-accent transition-colors">{villa.name}</h3>
                                </div>
                                <StatusBadge
                                    label={villa.status === 'available' ? 'Disponible' : 'En maintenance'}
                                    tone={villa.status === 'available' ? 'emerald' : 'amber'}
                                    rounded="md"
                                    uppercase
                                    className="px-2 py-1 text-[10px]"
                                />
                            </div>
                            <p className="text-secondary text-sm mb-4 flex-1 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" /> {villa.address || 'Aucune adresse renseignée'}
                            </p>
                            <div className="pt-4 border-t border-slate-100 dark:border-border-theme flex justify-between items-end">
                                <div>
                                    <span className="text-secondary text-xs font-medium block mb-1">Prix / Nuit</span>
                                    <span className="font-bold text-accent text-lg leading-none">{villa.price_per_night.toLocaleString('fr-FR')} F</span>
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleEdit(villa); }}
                                        className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                        title="Modifier la villa"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(villa); }}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Supprimer la villa"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Modal for adding a Villa */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                panelClassName="bg-panel rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-border-theme"
            >
                <div className="px-6 py-4 border-b border-slate-100 dark:border-border-theme flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <h2 className="text-xl font-bold text-primary">
                        {editingVilla ? 'Modifier la villa' : 'Ajouter un bien'}
                    </h2>
                    <button onClick={() => setIsAddOpen(false)} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {formError && (
                        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                            {formError}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1">Nom du bien / Villa</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                            placeholder="Ex: Villa Saly Vue Mer"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-primary mb-1">Adresse</label>
                        <input
                            type="text"
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
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
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary"
                            placeholder="Ex: 150000"
                            value={formData.price_per_night}
                            onChange={e => setFormData({...formData, price_per_night: e.target.value})}
                        />
                    </div>
                    <div className="pt-4">
                        <button type="submit" disabled={addVillaMutation.isPending || updateVillaMutation.isPending} className="btn-primary w-full py-3 text-base shadow-premium">
                            {addVillaMutation.isPending || updateVillaMutation.isPending ? 'Enregistrement...' : (editingVilla ? 'Enregistrer les modifications' : 'Enregistrer le bien')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
