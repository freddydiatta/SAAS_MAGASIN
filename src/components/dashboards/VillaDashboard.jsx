import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';

export const VillaDashboard = () => {
    const { user } = useAuth();
    const { selectedBusiness } = useBusiness();

    // Dummy data fetching - in real app you'd fetch from villas and bookings
    const { data: villas = [], isLoading: loadingVillas } = useQuery({
        queryKey: ['villas', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('villas')
                .select('*')
                .eq('business_id', selectedBusiness?.id);
            
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!selectedBusiness
    });

    const { data: bookings = [], isLoading: loadingBookings } = useQuery({
        queryKey: ['bookings', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, villas(name)')
                .eq('business_id', selectedBusiness?.id)
                .order('start_date', { ascending: true })
                .limit(10);
            
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!selectedBusiness
    });

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Aperçu Réservations (Villas)</h1>
                    <p className="text-secondary text-sm">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-primary px-5 py-2.5 text-sm">+ Nouvelle Réservation</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl mb-4">🏠</div>
                    <p className="text-secondary text-sm font-medium mb-1">Villas Gérées</p>
                    <p className="text-3xl font-bold text-primary mb-2">{loadingVillas ? "..." : villas.length}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl mb-4">📅</div>
                    <p className="text-secondary text-sm font-medium mb-1">Réservations Actives</p>
                    <p className="text-3xl font-bold text-primary mb-2">{loadingBookings ? "..." : bookings.length}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-premium relative">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl mb-4">💵</div>
                    <p className="text-secondary text-sm font-medium mb-1">Revenus (Bientôt)</p>
                    <p className="text-3xl font-bold text-primary mb-2">---</p>
                </div>
            </div>

            {/* List of upcoming bookings could go here */}
            <div className="bg-white rounded-2xl shadow-premium overflow-hidden mt-8">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-primary">Prochaines Arrivées</h2>
                </div>
                <div className="p-8 text-center text-secondary">
                    {loadingBookings ? 'Chargement...' : bookings.length === 0 ? 'Aucune réservation à venir.' : 'Réservations trouvées (à afficher).'}
                </div>
            </div>
        </div>
    );
};
