import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

export const Reservations = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({ 
        villa_id: '', 
        customer_name: '', 
        start_date: '', 
        end_date: '' 
    });

    const { data: villas = [] } = useQuery({
        queryKey: ['villas', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('villas').select('*').eq('business_id', selectedBusiness?.id);
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const { data: bookings = [], isLoading } = useQuery({
        queryKey: ['bookings', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, villas(name, price_per_night)')
                .eq('business_id', selectedBusiness?.id)
                .order('start_date', { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    // Compute total price dynamically based on dates and selected villa
    const getCalculatedPrice = () => {
        if (!formData.villa_id || !formData.start_date || !formData.end_date) return 0;
        const villa = villas.find(v => v.id === formData.villa_id);
        if (!villa) return 0;
        
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays > 0 ? diffDays * villa.price_per_night : villa.price_per_night; // At least 1 night
    };

    const addBookingMutation = useMutation({
        mutationFn: async (newBooking) => {
            const { data, error } = await supabase
                .from('bookings')
                .insert([{ ...newBooking, business_id: selectedBusiness.id }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['bookings']);
            setIsAddOpen(false);
            setFormData({ villa_id: '', customer_name: '', start_date: '', end_date: '' });
            alert('Réservation confirmée avec succès !');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const totalPrice = getCalculatedPrice();
        
        if (totalPrice <= 0) {
            alert('Veuillez vérifier les dates.');
            return;
        }

        addBookingMutation.mutate({
            villa_id: formData.villa_id,
            customer_name: formData.customer_name,
            start_date: formData.start_date,
            end_date: formData.end_date,
            total_price: totalPrice,
            status: 'confirmed'
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Réservations</h1>
                    <p className="text-secondary text-sm">Gérez les réservations de vos locataires.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsAddOpen(true)}
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        + Nouvelle Réservation
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-premium overflow-hidden border border-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Villa</th>
                                <th className="px-6 py-4">Période</th>
                                <th className="px-6 py-4">Montant Total</th>
                                <th className="px-6 py-4">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-secondary">Chargement...</td>
                                </tr>
                            ) : bookings.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-secondary">
                                        Aucune réservation trouvée.
                                    </td>
                                </tr>
                            ) : (
                                bookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-primary">
                                            {booking.customer_name}
                                        </td>
                                        <td className="px-6 py-4 text-secondary">
                                            {booking.villas?.name || 'Villa Inconnue'}
                                        </td>
                                        <td className="px-6 py-4 text-secondary text-sm">
                                            Du {new Date(booking.start_date).toLocaleDateString('fr-FR')} <br/>
                                            Au {new Date(booking.end_date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-primary">
                                            {booking.total_price.toLocaleString('fr-FR')} FCFA
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                                booking.status === 'confirmed' ? 'bg-indigo-100 text-indigo-800' : 
                                                booking.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {booking.status === 'confirmed' ? 'Confirmé' : booking.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for adding a Booking */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-bold text-primary">Nouvelle Réservation</h2>
                            <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">Villa</label>
                                <select 
                                    required
                                    className="input-field" 
                                    value={formData.villa_id}
                                    onChange={e => setFormData({...formData, villa_id: e.target.value})}
                                >
                                    <option value="">Sélectionnez une villa</option>
                                    {villas.map(v => (
                                        <option key={v.id} value={v.id}>{v.name} ({v.price_per_night.toLocaleString()} F/nuit)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">Nom du Client</label>
                                <input 
                                    type="text" 
                                    required
                                    className="input-field" 
                                    placeholder="Ex: M. Dupont"
                                    value={formData.customer_name}
                                    onChange={e => setFormData({...formData, customer_name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-1">Arrivée</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="input-field" 
                                        value={formData.start_date}
                                        onChange={e => setFormData({...formData, start_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-1">Départ</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="input-field" 
                                        value={formData.end_date}
                                        onChange={e => setFormData({...formData, end_date: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            {formData.villa_id && formData.start_date && formData.end_date && (
                                <div className="p-4 bg-indigo-50 rounded-xl mt-4 border border-indigo-100">
                                    <div className="flex justify-between items-center text-indigo-900">
                                        <span className="font-medium">Total Estimé:</span>
                                        <span className="text-xl font-bold">{getCalculatedPrice().toLocaleString('fr-FR')} FCFA</span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button type="submit" disabled={addBookingMutation.isPending} className="btn-primary w-full py-3">
                                    {addBookingMutation.isPending ? 'Confirmation...' : 'Confirmer la réservation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
