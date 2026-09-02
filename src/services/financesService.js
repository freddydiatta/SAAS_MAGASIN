import { supabase } from '../lib/supabase';

// Contrairement à useRetailDashboardStats (limité aux 30 derniers jours,
// pour un tableau de bord "aujourd'hui"), Finances a besoin de tout
// l'historique pour calculer le chiffre d'affaires total et la tendance
// mensuelle.
export const fetchAllSales = async (businessId) => {
    const { data, error } = await supabase
        .from('sales')
        .select('*, products(name), receipts!inner(status, payment_method)')
        .eq('business_id', businessId)
        .eq('receipts.status', 'completed')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
};
