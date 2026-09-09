import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { filterByDateRange } from '../lib/dateFilter';

export const ACTION_OPTIONS = [
    { value: 'all', label: 'Toutes les actions' },
    { value: 'CANCEL_SALE', label: 'Vente annulée' },
    { value: 'MODIFY_SALE', label: 'Vente modifiée' },
    { value: 'MODIFY_DEBT', label: 'Dette modifiée' },
    { value: 'MODIFY_PURCHASE_ORDER', label: 'Bon de commande modifié' },
    { value: 'UNRECEIVE_PURCHASE_ORDER', label: 'Réception de bon annulée' },
    { value: 'DELETE_PURCHASE_ORDER', label: 'Bon de commande supprimé' },
    { value: 'VALIDATE_INVENTORY', label: 'Inventaire validé' },
    { value: 'LOGIN_SUCCESS', label: 'Connexion réussie' },
    { value: 'LOGIN_FAILED', label: 'Connexion échouée' },
    { value: 'LOGIN_FAILED_PIN', label: 'Code PIN incorrect' },
    { value: 'ACCOUNT_LOCKED', label: 'Compte verrouillé' },
];

// Sorti d'AuditLogs.jsx (qui faisait la requête en ligne, sans aucun filtre)
// pour ajouter les mêmes filtres date + type d'action que l'Historique des
// ventes, avec la même logique de date partagée (voir src/lib/dateFilter.js).
export function useAuditLogs(selectedBusiness) {
    const [actionFilter, setActionFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const { data: allLogs = [], isLoading } = useQuery({
        queryKey: ['audit_logs', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const logs = useMemo(() => {
        const byAction = actionFilter === 'all'
            ? allLogs
            : allLogs.filter((log) => log.action === actionFilter);
        return filterByDateRange(byAction, (log) => log.created_at, { dateFilter, customFrom, customTo });
    }, [allLogs, actionFilter, dateFilter, customFrom, customTo]);

    return {
        logs,
        totalLogsCount: allLogs.length,
        isLoading,
        actionFilter,
        setActionFilter,
        dateFilter,
        setDateFilter,
        customFrom,
        setCustomFrom,
        customTo,
        setCustomTo,
    };
}
