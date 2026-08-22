import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cancelSale, modifySale } from '../services/salesService';

// Requêtes, mutations et calculs de l'historique des ventes (annulation,
// modification, préparation de l'impression) : sorti de HistoriqueVentes.jsx
// pour que ce composant se concentre sur le rendu du tableau/des modales.
export function useSalesHistory(selectedBusiness, actorLabel) {
    const queryClient = useQueryClient();

    const [toastMessage, setToastMessage] = useState('');
    const [receiptToCancel, setReceiptToCancel] = useState(null);
    const [receiptToPrint, setReceiptToPrint] = useState(null);
    const [receiptToModify, setReceiptToModify] = useState(null);
    const [modifiedItems, setModifiedItems] = useState([]);

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const { data: receipts = [], isLoading } = useQuery({
        queryKey: ['receipts', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('receipts')
                .select('*, sales(*, products(name, type))')
                .eq('business_id', selectedBusiness?.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const invalidateAfterSaleChange = () => {
        queryClient.invalidateQueries(['receipts']);
        queryClient.invalidateQueries(['products']);
        queryClient.invalidateQueries(['sales']);
    };

    const cancelReceiptMutation = useMutation({
        mutationFn: async (receipt) => {
            // Annulation + restauration du stock + audit log en une seule
            // transaction côté base de données (voir cancel_sale dans
            // supabase/patches/2026-08-21_critical_fixes.sql).
            const { error } = await cancelSale({
                receiptId: receipt.id,
                userEmail: actorLabel
            });
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateAfterSaleChange();
            setReceiptToCancel(null);
            showToast('✅ Vente annulée avec succès. Le stock a été restauré.');
        },
        onError: (error) => {
            console.error("Erreur lors de l'annulation:", error.message);
            showToast('❌ Une erreur est survenue lors de l\'annulation.');
        }
    });

    const confirmCancel = () => {
        if (receiptToCancel) {
            cancelReceiptMutation.mutate(receiptToCancel);
        }
    };

    const handlePrint = (receipt) => {
        setReceiptToPrint({
            receiptId: receipt.id,
            date: receipt.created_at,
            customerName: receipt.customer_name,
            customerPhone: receipt.customer_phone,
            items: receipt.sales.map(s => ({
                name: s.products?.name,
                quantity: s.quantity,
                price: s.total_price / s.quantity
            })),
            total: receipt.total_amount
        });
    };

    const handleModify = (receipt) => {
        setReceiptToModify(receipt);
        setModifiedItems(receipt.sales.map(s => ({
            id: s.id,
            product_id: s.product_id,
            name: s.products?.name || 'Produit',
            original_qty: s.quantity,
            new_qty: s.quantity,
            price: s.total_price / s.quantity
        })));
    };

    const updateModifiedQty = (saleId, newQty) => {
        if (newQty < 0) return;
        setModifiedItems(prev => prev.map(item =>
            item.id === saleId ? { ...item, new_qty: newQty } : item
        ));
    };

    const modifyReceiptMutation = useMutation({
        mutationFn: async ({ receipt, items }) => {
            // Mise à jour des lignes de vente + ajustement du stock + audit log
            // en une seule transaction côté base de données (voir modify_sale
            // dans supabase/patches/2026-08-21_critical_fixes.sql).
            const { error } = await modifySale({
                receiptId: receipt.id,
                userEmail: actorLabel,
                items: items.map(item => ({
                    sale_id: item.id,
                    product_id: item.product_id,
                    name: item.name,
                    original_qty: item.original_qty,
                    new_qty: item.new_qty,
                    price: item.price
                }))
            });
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateAfterSaleChange();
            setReceiptToModify(null);
            showToast('✅ Vente modifiée avec succès.');
        },
        onError: (error) => {
            console.error("Erreur modif:", error.message);
            showToast('❌ Erreur lors de la modification.');
        }
    });

    const confirmModify = () => {
        if (receiptToModify) {
            modifyReceiptMutation.mutate({ receipt: receiptToModify, items: modifiedItems });
        }
    };

    return {
        receipts,
        isLoading,
        toastMessage,
        receiptToCancel,
        setReceiptToCancel,
        confirmCancel,
        isCancelling: cancelReceiptMutation.isPending,
        receiptToPrint,
        setReceiptToPrint,
        handlePrint,
        receiptToModify,
        setReceiptToModify,
        modifiedItems,
        handleModify,
        updateModifiedQty,
        confirmModify,
        isModifying: modifyReceiptMutation.isPending,
    };
}
