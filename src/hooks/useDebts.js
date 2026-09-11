import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchDebts, addDebt, updateDebt, markDebtPaid, deleteDebt } from '../services/debtsService';
import { debtSchema, firstZodError } from '../lib/validation';

const EMPTY_FORM = { customerName: '', customerPhone: '', amount: '', note: '' };

// Dettes clients (crédit) : partagé par tous les verticaux, même logique
// que useExpenses.js.
export function useDebts(selectedBusiness) {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    // null = mode ajout ; une dette = mode modification (même formulaire,
    // voir openEditForm).
    const [editingDebt, setEditingDebt] = useState(null);
    // { type: 'delete', item: debt } — remplace window.confirm par
    // ConfirmModal, cohérent avec le reste de l'app.
    const [confirmAction, setConfirmAction] = useState(null);
    // null = fermé ; une dette = on demande par quel moyen elle a été
    // remboursée. Ce n'est pas un simple oui/non (donc pas un ConfirmModal) :
    // le choix espèces/Mobile Money est ce qui permet ensuite de recouper la
    // caisse dans Finances et dans la caisse du jour.
    const [debtToSettle, setDebtToSettle] = useState(null);

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

    // Journalisée côté base (voir update_debt) : jamais une correction
    // silencieuse, toujours une trace consultable dans Sécurité.
    const updateDebtMutation = useMutation({
        mutationFn: (debt) => updateDebt({ debtId: editingDebt.id, ...debt }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['audit_logs', selectedBusiness?.id] });
            setIsAddOpen(false);
            setEditingDebt(null);
            setFormData(EMPTY_FORM);
            toast.success('Dette modifiée.');
        },
        onError: (error) => toast.error(error.message || 'Erreur lors de la modification de la dette.'),
    });

    const markPaidMutation = useMutation({
        mutationFn: markDebtPaid,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setDebtToSettle(null);
            toast.success('Dette marquée comme remboursée.');
        },
        onError: () => toast.error('Erreur lors de la mise à jour de la dette.'),
    });

    const deleteDebtMutation = useMutation({
        mutationFn: deleteDebt,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setConfirmAction(null);
            toast.success('Dette supprimée.');
        },
        onError: () => toast.error('Erreur lors de la suppression.'),
    });

    const openAddForm = () => {
        setEditingDebt(null);
        setFormData(EMPTY_FORM);
        setIsAddOpen(true);
    };

    const openEditForm = (debt) => {
        setEditingDebt(debt);
        setFormData({
            customerName: debt.customer_name || '',
            customerPhone: debt.customer_phone || '',
            amount: String(debt.amount),
            note: debt.note || '',
        });
        setIsAddOpen(true);
    };

    const closeForm = () => {
        setIsAddOpen(false);
        setEditingDebt(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const result = debtSchema.safeParse(formData);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }
        if (editingDebt) {
            updateDebtMutation.mutate(result.data);
        } else {
            addDebtMutation.mutate(result.data);
        }
    };

    const handleMarkPaid = (debt) => setDebtToSettle(debt);
    const closeSettleForm = () => setDebtToSettle(null);
    const confirmRepayment = (paymentMethod) => {
        if (!debtToSettle) return;
        markPaidMutation.mutate({ id: debtToSettle.id, paymentMethod });
    };

    const handleDelete = (debt) => setConfirmAction({ type: 'delete', item: debt });

    const closeConfirmAction = () => setConfirmAction(null);

    const confirmPendingAction = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'delete') deleteDebtMutation.mutate(confirmAction.item.id);
    };

    const isConfirmingAction = deleteDebtMutation.isPending;

    return {
        debts,
        unpaidDebts,
        totalOwed,
        isLoading,
        isAddOpen,
        editingDebt,
        openAddForm,
        openEditForm,
        closeForm,
        formData,
        setFormData,
        handleSubmit,
        handleMarkPaid,
        handleDelete,
        isSaving: addDebtMutation.isPending || updateDebtMutation.isPending,

        debtToSettle,
        closeSettleForm,
        confirmRepayment,
        isSettlingDebt: markPaidMutation.isPending,

        confirmAction,
        closeConfirmAction,
        confirmPendingAction,
        isConfirmingAction,
    };
}
