import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Tous les calculs de KPI du tableau de bord restaurant (commandes en
// cours, caisse du jour, plats servis, tables ouvertes) : avant,
// RestaurantDashboard.jsx n'interrogeait rien du tout, chaque chiffre était
// codé en dur à 0. Même clé de requête ['restaurant_orders', businessId]
// que useRestaurantOrders.js pour que les deux pages partagent le cache
// React Query au lieu de refaire la requête indépendamment.
export function useRestaurantDashboardStats(selectedBusiness) {
    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['restaurant_orders', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('restaurant_orders')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const today = new Date().setHours(0, 0, 0, 0);
    const todaysOrders = orders.filter(o => new Date(o.created_at).getTime() >= today);

    const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'served');
    const commandesEnCours = activeOrders.length;

    const caisseDuJour = todaysOrders
        .filter(o => o.status === 'paid')
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const platsServis = todaysOrders
        .filter(o => o.status === 'served' || o.status === 'paid')
        .reduce((sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0), 0);

    const tablesOuvertes = new Set(
        activeOrders
            .filter(o => o.table_number && o.table_number !== 'À emporter')
            .map(o => o.table_number)
    ).size;

    const recentOrders = orders.slice(0, 5);

    return {
        isLoading,
        commandesEnCours,
        caisseDuJour,
        platsServis,
        tablesOuvertes,
        recentOrders,
    };
}
