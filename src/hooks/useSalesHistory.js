import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cancelSale, modifySale } from '../services/salesService';
import { filterByDateRange } from '../lib/dateFilter';

// Requêtes, mutations et calculs de l'historique des ventes (annulation,
// modification, préparation de l'impression) : sorti de HistoriqueVentes.jsx
// pour que ce composant se concentre sur le rendu du tableau/des modales.
export function useSalesHistory(selectedBusiness) {
    const queryClient = useQueryClient();

    const [toastMessage, setToastMessage] = useState('');
    const [receiptToCancel, setReceiptToCancel] = useState(null);
    const [receiptToPrint, setReceiptToPrint] = useState(null);
    const [receiptToModify, setReceiptToModify] = useState(null);
    const [modifiedItems, setModifiedItems] = useState([]);
    // Les boutons "7 jours"/"30 jours"/"Période" existaient déjà dans le
    // rendu mais n'étaient reliés à rien.
    const [dateFilter, setDateFilter] = useState('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const { data: allReceipts = [], isLoading } = useQuery({
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

    const receipts = useMemo(
        () => filterByDateRange(allReceipts, (r) => r.created_at, { dateFilter, customFrom, customTo }),
        [allReceipts, dateFilter, customFrom, customTo]
    );

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
            });
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateAfterSaleChange();
            setReceiptToCancel(null);
            showToast('✅ Vente annulée avec succès. Le stock a été restauré.');
        },
        onError: (error) => {
            // cancel_sale refuse explicitement certaines annulations (vente à
            // crédit déjà remboursée, vente déjà annulée) : dire laquelle vaut
            // mieux qu'un "une erreur est survenue" qui laisse chercher.
            console.error("Erreur lors de l'annulation:", error.message);
            showToast(`❌ ${error.message || "Une erreur est survenue lors de l'annulation."}`);
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
            // id de ligne pour l'existant ; une ligne ajoutée pendant la
            // correction n'en a pas encore et se repère par sa clé locale.
            id: s.id,
            saleId: s.id,
            product_id: s.product_id,
            name: s.products?.name || 'Produit',
            original_qty: s.quantity,
            new_qty: s.quantity,
            price: s.total_price / s.quantity
        })));
    };

    // 0 est une valeur légitime : c'est ainsi qu'on retire un article rendu
    // par le client (la ligne est supprimée côté base, voir modify_sale).
    const updateModifiedQty = (itemId, newQty) => {
        if (newQty < 0) return;
        setModifiedItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, new_qty: newQty } : item
        ));
    };

    // Échange au comptoir : le client rend un article et en prend un autre.
    // Le produit ajouté part à sa quantité 1, ajustable ensuite comme les
    // autres lignes.
    const addProductToModify = (product) => {
        if (!product) return;
        setModifiedItems(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product_id === product.id ? { ...item, new_qty: item.new_qty + 1 } : item
                );
            }
            return [...prev, {
                id: `new-${product.id}`,
                saleId: null,
                product_id: product.id,
                name: product.name,
                original_qty: 0,
                new_qty: 1,
                price: Number(product.price),
            }];
        });
    };

    const modifyReceiptMutation = useMutation({
        mutationFn: async ({ receipt, items }) => {
            // Mise à jour des lignes de vente + ajustement du stock + audit log
            // en une seule transaction côté base de données (voir modify_sale
            // dans supabase/patches/2026-08-21_critical_fixes.sql).
            // Ni prix ni nom ne sont transmis : la base garde le prix facturé
            // à l'époque pour une ligne existante, et applique le prix courant
            // pour un produit ajouté (voir modify_sale).
            const { error } = await modifySale({
                receiptId: receipt.id,
                items: items.map(item => ({
                    sale_id: item.saleId,
                    product_id: item.product_id,
                    new_qty: item.new_qty,
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
            // modify_sale renvoie un message précis (stock insuffisant, vente
            // vidée de tous ses articles...) : l'afficher tel quel aide plus
            // qu'un message générique.
            console.error("Erreur modif:", error.message);
            showToast(`❌ ${error.message || 'Erreur lors de la modification.'}`);
        }
    });

    const confirmModify = () => {
        if (receiptToModify) {
            modifyReceiptMutation.mutate({ receipt: receiptToModify, items: modifiedItems });
        }
    };

    return {
        receipts,
        totalReceiptsCount: allReceipts.length,
        isLoading,
        dateFilter,
        setDateFilter,
        customFrom,
        setCustomFrom,
        customTo,
        setCustomTo,
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
        addProductToModify,
        confirmModify,
        isModifying: modifyReceiptMutation.isPending,
    };
}
