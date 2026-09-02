import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchDebts, addDebt, markDebtPaid, deleteDebt } from '../services/debtsService';
import { debtSchema, firstZodError } from '../lib/validation';

const EMPTY_FORM = { customerName: '', customerPhone: '', amount: '', note: '' };

// Dettes clients (crédit) : partagé par tous les verticaux, même logique
// que useExpenses.js.
export function useDebts(selectedBusiness) {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const queryKey = ['debts', selectedBusiness?.id];

    const { data: debts = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchDebts(selectedBusiness.id),
        enabled: !!selectedBusiness,
    });

    const unpaidDebts = debts.filter((d) => d.status !== 'paid');
    const totalOwed = unpaidDebts.reduce((sum, d) => sum + Number(d.amount), 0);

    const addDebtMutation = useMutation({
        mutationFn: (debt) => addDebt({ businessId: selectedBusiness.id, ...debt }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setIsAddOpen(false);
            setFormData(EMPTY_FORM);
            toast.success('Dette enregistrée.');
        },
        onError: () => toast.error("Erreur lors de l'enregistrement de la dette."),
    });

    const markPaidMutation = useMutation({
        mutationFn: markDebtPaid,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success('Dette marquée comme remboursée.');
        },
        onError: () => toast.error('Erreur lors de la mise à jour de la dette.'),
    });

    const deleteDebtMutation = useMutation({
        mutationFn: deleteDebt,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success('Dette supprimée.');
        },
        onError: () => toast.error('Erreur lors de la suppression.'),
    });

    const openAddForm = () => {
        setFormData(EMPTY_FORM);
        setIsAddOpen(true);
    };

    const closeForm = () => setIsAddOpen(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const result = debtSchema.safeParse(formData);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }
        addDebtMutation.mutate(result.data);
    };

    const handleMarkPaid = (debt) => {
        if (window.confirm(`Confirmer que ${debt.customer_name} a remboursé ${Number(debt.amount).toLocaleString('fr-FR')} FCFA ?`)) {
            markPaidMutation.mutate(debt.id);
        }
    };

    const handleDelete = (debt) => {
        if (window.confirm('Supprimer cette dette ?')) {
            deleteDebtMutation.mutate(debt.id);
        }
    };

    return {
        debts,
        unpaidDebts,
        totalOwed,
        isLoading,
        isAddOpen,
        openAddForm,
        closeForm,
        formData,
        setFormData,
        handleSubmit,
        handleMarkPaid,
        handleDelete,
        isSaving: addDebtMutation.isPending,
    };
}
