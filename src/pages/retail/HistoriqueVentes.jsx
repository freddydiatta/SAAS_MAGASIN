import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

export const HistoriqueVentes = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    
    const [toastMessage, setToastMessage] = useState('');
    const [receiptToCancel, setReceiptToCancel] = useState(null);

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

    const cancelReceiptMutation = useMutation({
        mutationFn: async (receipt) => {
            // 1. Update receipt status
            const { error: receiptError } = await supabase
                .from('receipts')
                .update({ status: 'cancelled' })
                .eq('id', receipt.id);
            if (receiptError) throw receiptError;

            // 2. Restore stock for each item
            for (const sale of receipt.sales) {
                if (!sale.product_id) continue;
                
                // Fetch current stock first
                const { data: productData, error: productFetchError } = await supabase
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', sale.product_id)
                    .single();
                    
                if (productFetchError || !productData) continue;

                // Update stock
                await supabase
                    .from('products')
                    .update({ stock_quantity: productData.stock_quantity + sale.quantity })
                    .eq('id', sale.product_id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['receipts']);
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
            setReceiptToCancel(null);
            showToast('✅ Vente annulée avec succès. Le stock a été restauré.');
        },
        onError: (error) => {
            console.error("Erreur lors de l'annulation:", error);
            showToast('❌ Une erreur est survenue lors de l\'annulation.');
        }
    });

    const confirmCancel = () => {
        if (receiptToCancel) {
            cancelReceiptMutation.mutate(receiptToCancel);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-secondary">Chargement de l'historique...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up relative">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg font-medium animate-fade-in-up flex items-center gap-2">
                    {toastMessage}
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {receiptToCancel && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-premium animate-fade-in-up">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-2xl mb-4 mx-auto">
                            ⚠️
                        </div>
                        <h2 className="text-xl font-bold text-primary text-center mb-2">Annuler la vente ?</h2>
                        <p className="text-secondary text-center mb-8">
                            Êtes-vous sûr de vouloir annuler cette transaction de <strong>{receiptToCancel.total_amount.toLocaleString('fr-FR')} FCFA</strong> ?<br/><br/>
                            Le montant sera déduit de votre caisse et le stock des articles sera automatiquement restauré.
                        </p>
                        
                        <div className="flex gap-3">
                            <button onClick={() => setReceiptToCancel(null)} className="flex-1 btn-secondary bg-slate-100 py-3">Retour</button>
                            <button 
                                onClick={confirmCancel} 
                                disabled={cancelReceiptMutation.isLoading}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-3 transition-colors disabled:opacity-50"
                            >
                                {cancelReceiptMutation.isLoading ? 'Annulation...' : 'Oui, annuler'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary tracking-tight">Historique des Ventes</h1>
                    <p className="text-secondary mt-1">Consultez toutes vos transactions et annulez en cas d'erreur.</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Date & Heure</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Client</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm">Articles</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm text-right">Total</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm text-center">Statut</th>
                                <th className="py-4 px-6 font-semibold text-secondary text-sm text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {receipts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-secondary">
                                        Aucune vente enregistrée pour le moment.
                                    </td>
                                </tr>
                            ) : (
                                receipts.map(receipt => (
                                    <tr key={receipt.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-primary">
                                                {new Date(receipt.created_at).toLocaleDateString('fr-FR')}
                                            </div>
                                            <div className="text-xs text-secondary">
                                                {new Date(receipt.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {receipt.customer_name ? (
                                                <div>
                                                    <div className="font-medium text-primary">{receipt.customer_name}</div>
                                                    {receipt.customer_phone && <div className="text-xs text-secondary">{receipt.customer_phone}</div>}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Client Comptoir</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1">
                                                {receipt.sales?.map(sale => (
                                                    <div key={sale.id} className="text-sm text-secondary">
                                                        <span className="font-medium text-primary">{sale.quantity}x</span> {sale.products?.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right font-bold text-primary">
                                            {receipt.total_amount.toLocaleString('fr-FR')} FCFA
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {receipt.status === 'cancelled' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Annulé
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                    Terminé
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {receipt.status !== 'cancelled' && (
                                                <button 
                                                    onClick={() => setReceiptToCancel(receipt)}
                                                    className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors bg-red-50 px-3 py-1.5 rounded-lg"
                                                >
                                                    Annuler
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
