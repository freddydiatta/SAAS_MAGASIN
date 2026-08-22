import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

// Commandes de restaurant : jusqu'ici Commandes.jsx pouvait seulement CRÉER
// une commande (insert avec status: 'pending') — rien ne la lisait ni ne la
// faisait avancer ensuite (servie/payée/annulée), donc toute commande créée
// devenait invisible et bloquée pour toujours. Ce hook ajoute la lecture et
// les transitions de statut, en plus de la création existante.
export function useRestaurantOrders(selectedBusiness) {
    const queryClient = useQueryClient();
    const queryKey = ['restaurant_orders', selectedBusiness?.id];

    const { data: orders = [], isLoading: loadingOrders } = useQuery({
        queryKey,
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

    const invalidateOrders = () => queryClient.invalidateQueries({ queryKey });

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            const { data, error } = await supabase
                .from('restaurant_orders')
                .insert([{
                    business_id: selectedBusiness.id,
                    table_number: orderData.tableNumber || 'À emporter',
                    total_amount: orderData.total,
                    status: 'pending',
                    items: orderData.items
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            invalidateOrders();
            toast.success('Commande envoyée en cuisine !');
        }
    });

    const statusLabels = { served: 'servie', paid: 'payée', cancelled: 'annulée' };

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }) => {
            const { error } = await supabase.from('restaurant_orders').update({ status }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_, { status }) => {
            invalidateOrders();
            toast.success(`Commande marquée ${statusLabels[status] || status}.`);
        },
        onError: () => toast.error('Erreur lors de la mise à jour de la commande.'),
    });

    return {
        orders,
        loadingOrders,
        activeOrders: orders.filter(o => o.status === 'pending' || o.status === 'served'),
        createOrder: createOrderMutation.mutate,
        isCreatingOrder: createOrderMutation.isPending,
        setOrderStatus: (id, status) => updateStatusMutation.mutate({ id, status }),
        isUpdatingStatus: updateStatusMutation.isPending,
    };
}
