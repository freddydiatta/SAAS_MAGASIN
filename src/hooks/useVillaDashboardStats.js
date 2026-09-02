import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ');

// Tous les calculs de KPI du tableau de bord villa (revenus du mois,
// réservations actives, prochaines arrivées) : VillaDashboard.jsx affichait
// jusqu'ici des données factices ("Revenus Mensuels: ---" en dur). Mêmes
// clés de requête que useReservations (['villas', businessId] et
// ['bookings', businessId]) pour partager le cache React Query.
export function useVillaDashboardStats(selectedBusiness) {
    const { data: villas = [], isLoading: loadingVillas } = useQuery({
        queryKey: ['villas', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('villas').select('*').eq('business_id', selectedBusiness?.id);
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness,
    });

    const { data: bookings = [], isLoading: loadingBookings } = useQuery({
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
        enabled: !!selectedBusiness,
    });

    // Pas de contrainte CHECK en base sur ce champ (cf. Reservations.jsx) :
    // les valeurs réellement utilisées par l'app sont en français.
    const nonCancelled = bookings.filter((b) => b.status !== 'annulé');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = nonCancelled.filter((b) => new Date(b.end_date) >= today);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthlyRevenue = nonCancelled
        .filter((b) => {
            const start = new Date(b.start_date);
            return start >= monthStart && start < monthEnd;
        })
        .reduce((sum, b) => sum + Number(b.total_price), 0);

    const upcomingBookings = activeBookings
        .filter((b) => new Date(b.start_date) >= today)
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        .slice(0, 10);

    return {
        villas,
        villasCount: villas.length,
        bookings,
        activeBookingsCount: activeBookings.length,
        monthlyRevenue,
        upcomingBookings,
        isLoading: loadingVillas || loadingBookings,
        formatFCFA,
    };
}
