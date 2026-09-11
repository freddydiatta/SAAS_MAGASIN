import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
    fetchMoneyAccounts,
    addMoneyAccount,
    updateMoneyAccount,
    deleteMoneyAccount,
} from '../services/moneyAccountsService';
import { moneyAccountSchema, firstZodError } from '../lib/validation';

const EMPTY_FORM = { name: '', kind: 'cash', openingBalance: '' };

// Soldes réels des comptes du commerce (caisse, Wave, Orange Money...) : à
// comparer avec ce que l'application a calculé de son côté.
export function useMoneyAccounts(selectedBusiness) {
    const queryClient = useQueryClient();
    const businessId = selectedBusiness?.id;
    const queryKey = ['money_accounts', businessId];

    const { data: accounts = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchMoneyAccounts(businessId),
        enabled: !!businessId,
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    // null = mode ajout ; un compte = mode modification (même formulaire).
    const [editingAccount, setEditingAccount] = useState(null);
    const [accountToDelete, setAccountToDelete] = useState(null);

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingAccount(null);
    };

    const addMutation = useMutation({
        mutationFn: (account) => addMoneyAccount({ businessId, ...account }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            closeForm();
            setFormData(EMPTY_FORM);
            toast.success('Compte ajouté.');
        },
        onError: () => toast.error("Erreur lors de l'ajout du compte."),
    });

    const updateMutation = useMutation({
        mutationFn: (account) => updateMoneyAccount({ id: editingAccount.id, ...account }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            closeForm();
            setFormData(EMPTY_FORM);
            toast.success('Point de départ mis à jour.');
        },
        onError: () => toast.error('Erreur lors de la mise à jour du solde.'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteMoneyAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setAccountToDelete(null);
            toast.success('Compte supprimé.');
        },
        onError: () => toast.error('Erreur lors de la suppression du compte.'),
    });

    const openAddForm = () => {
        setEditingAccount(null);
        setFormData(EMPTY_FORM);
        setIsFormOpen(true);
    };

    const openEditForm = (account) => {
        setEditingAccount(account);
        setFormData({ name: account.name, kind: account.kind, openingBalance: String(account.opening_balance) });
        setIsFormOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const result = moneyAccountSchema.safeParse(formData);
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }
        if (editingAccount) {
            updateMutation.mutate(result.data);
        } else {
            addMutation.mutate(result.data);
        }
    };

    const handleDelete = (account) => setAccountToDelete(account);
    const closeDeleteConfirm = () => setAccountToDelete(null);
    const confirmDelete = () => {
        if (!accountToDelete) return;
        deleteMutation.mutate(accountToDelete.id);
    };

    // Regroupés par moyen de paiement : ce sont les points de départ de
    // chaque solde, que useFinances fait ensuite évoluer avec les
    // encaissements et les dépenses.
    const cashAccounts = accounts.filter((account) => account.kind === 'cash');
    const mobileAccounts = accounts.filter((account) => account.kind === 'mobile_money');

    return {
        accounts,
        cashAccounts,
        mobileAccounts,
        isLoading,

        isFormOpen,
        editingAccount,
        openAddForm,
        openEditForm,
        closeForm,
        formData,
        setFormData,
        handleSubmit,
        isSaving: addMutation.isPending || updateMutation.isPending,

        accountToDelete,
        handleDelete,
        closeDeleteConfirm,
        confirmDelete,
        isDeleting: deleteMutation.isPending,
    };
}
