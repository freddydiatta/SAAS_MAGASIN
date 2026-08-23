import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchExpenses, addExpense, deleteExpense } from '../services/expensesService';
import { expenseSchema, firstZodError } from '../lib/validation';

const EMPTY_FORM = { category: 'divers', label: '', amount: '' };

// Requêtes/mutations des dépenses (transport, divers...) : partagé par tous
// les verticaux (retail/motos, restaurant, villas), même page/logique
// partout — pas de raison de dupliquer par métier.
export function useExpenses(selectedBusiness, actorLabel) {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const queryKey = ['expenses', selectedBusiness?.id];

    const { data: expenses = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchExpenses(selectedBusiness.id),
        enabled: !!selectedBusiness,
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const today = new Date().setHours(0, 0, 0, 0);
    const totalExpensesToday = expenses
        .filter((e) => new Date(e.created_at).getTime() >= today)
        .reduce((sum, e) => sum + Number(e.amount), 0);

    const addExpenseMutation = useMutation({
        mutationFn: (newExpense) => addExpense({ businessId: selectedBusiness.id, createdBy: actorLabel, ...newExpense }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setIsAddOpen(false);
            setFormData(EMPTY_FORM);
            toast.success('Dépense enregistrée.');
        },
        onError: (error) => {
            console.error("Erreur lors de l'ajout de la dépense:", error.message);
            toast.error("Erreur lors de l'ajout de la dépense.");
        },
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: deleteExpense,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success('Dépense supprimée.');
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

        const result = expenseSchema.safeParse(formData);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }

        addExpenseMutation.mutate(result.data);
    };

    const handleDelete = (expense) => {
        if (window.confirm('Supprimer cette dépense ?')) {
            deleteExpenseMutation.mutate(expense.id);
        }
    };

    return {
        expenses,
        isLoading,
        totalExpenses,
        totalExpensesToday,
        isAddOpen,
        openAddForm,
        closeForm,
        formData,
        setFormData,
        handleSubmit,
        handleDelete,
        isSaving: addExpenseMutation.isPending,
    };
}
