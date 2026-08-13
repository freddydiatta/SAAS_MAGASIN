import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

export const HistoriqueVentes = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();

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
            alert('Vente annulée avec succès. Le stock a été restauré.');
        },
        onError: (error) => {
            console.error("Erreur lors de l'annulation:", error);
            alert('Une erreur est survenue lors de l\'annulation.');
        }
    });

    const handleCancel = (receipt) => {
        if (window.confirm("Êtes-vous sûr de vouloir annuler cette vente ? Le montant sera déduit et le stock restauré.")) {
            cancelReceiptMutation.mutate(receipt);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-secondary">Chargement de l'historique...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-end">
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
                                                    onClick={() => handleCancel(receipt)}
                                                    disabled={cancelReceiptMutation.isLoading}
                                                    className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
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
