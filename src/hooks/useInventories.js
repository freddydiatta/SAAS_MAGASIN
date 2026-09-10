import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchInventories, startInventory, deleteInventory } from '../services/inventoriesService';
import { productKeys } from '../services/productsService';

// Inventaires physiques (comptage périodique) : voir InventoryCountModal
// pour le comptage lui-même — ce hook ne gère que la liste, le démarrage et
// la suppression d'un brouillon.
export function useInventories(selectedBusiness) {
    const queryClient = useQueryClient();
    const businessId = selectedBusiness?.id;

    const queryKey = ['inventories', businessId];
    const { data: inventories = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchInventories(businessId),
        enabled: !!businessId,
    });

    const [isStartFormOpen, setIsStartFormOpen] = useState(false);
    const [note, setNote] = useState('');
    // L'inventaire actuellement ouvert dans la modale de comptage (voir
    // InventoryCountModal) — null quand aucune modale de comptage n'est
    // ouverte.
    const [activeInventory, setActiveInventory] = useState(null);
    // { type: 'deleteInventory', item } — même pattern ConfirmModal que
    // useFournisseurs.
    const [confirmAction, setConfirmAction] = useState(null);

    const startInventoryMutation = useMutation({
        mutationFn: () => startInventory({ businessId, note }),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey });
            setIsStartFormOpen(false);
            setNote('');
            // Ouvre directement le comptage : démarrer un inventaire sans
            // enchaîner sur la saisie n'aurait pas de sens.
            setActiveInventory(created);
            toast.success('Inventaire démarré.');
        },
        onError: (error) => toast.error(error.message || "Erreur lors du démarrage de l'inventaire."),
    });

    const deleteInventoryMutation = useMutation({
        mutationFn: deleteInventory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setConfirmAction(null);
            toast.success('Inventaire supprimé.');
        },
        onError: (error) => toast.error(error.message || "Erreur lors de la suppression de l'inventaire."),
    });

    const openStartForm = () => {
        setNote('');
        setIsStartFormOpen(true);
    };
    const closeStartForm = () => setIsStartFormOpen(false);
    const handleStartInventory = (e) => {
        e.preventDefault();
        startInventoryMutation.mutate();
    };

    const openInventory = (inventory) => setActiveInventory(inventory);
    const closeInventory = () => setActiveInventory(null);

    const handleDeleteInventory = (inventory) => setConfirmAction({ type: 'deleteInventory', item: inventory });
    const closeConfirmAction = () => setConfirmAction(null);
    const confirmPendingAction = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'deleteInventory') deleteInventoryMutation.mutate(confirmAction.item.id);
    };

    // Le stock a pu bouger (voir validate_inventory) : appelé par
    // InventoryCountModal une fois la validation confirmée, en plus de son
    // propre rafraîchissement de la liste des items.
    const onInventoryValidated = () => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: productKeys.all(businessId) });
        queryClient.invalidateQueries({ queryKey: ['audit_logs', businessId] });
    };

    return {
        inventories,
        isLoading,

        isStartFormOpen,
        openStartForm,
        closeStartForm,
        note,
        setNote,
        handleStartInventory,
        isStartingInventory: startInventoryMutation.isPending,

        activeInventory,
        openInventory,
        closeInventory,
        onInventoryValidated,

        confirmAction,
        closeConfirmAction,
        confirmPendingAction,
        isConfirmingAction: deleteInventoryMutation.isPending,
        handleDeleteInventory,
    };
}
