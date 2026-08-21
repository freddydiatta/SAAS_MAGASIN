import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { InvoicePrint } from '../../components/InvoicePrint';
import { cancelSale, modifySale } from '../../services/salesService';
import { FileText, Edit2, Ban, Calendar, AlertTriangle, Plus, Minus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const HistoriqueVentes = () => {
    const { selectedBusiness, currentMember } = useBusiness();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    // Un caissier a un compte auto-généré (email interne illisible) : on
    // journalise son nom d'affichage plutôt que cet email quand disponible.
    const actorLabel = currentMember?.name || user?.email || 'unknown';
    
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
            queryClient.invalidateQueries(['receipts']);
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
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
        const invoiceDetails = {
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
        };
        setReceiptToPrint(invoiceDetails);
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
            queryClient.invalidateQueries(['receipts']);
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
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

            {/* Print Invoice Modal */}
            {receiptToPrint && (
                <InvoicePrint 
                    invoiceDetails={receiptToPrint}
                    business={selectedBusiness}
                    onClose={() => setReceiptToPrint(null)}
                />
            )}

            {/* Cancel Confirmation Modal */}
            <AnimatePresence>
                {receiptToCancel && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-panel rounded-3xl p-8 max-w-md w-full shadow-premium"
                        >
                            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mb-6 mx-auto">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-primary text-center mb-2">Annuler la vente ?</h2>
                        <p className="text-secondary text-center mb-8">
                            Êtes-vous sûr de vouloir annuler cette transaction de <strong>{receiptToCancel.total_amount.toLocaleString('fr-FR')} FCFA</strong> ?<br/><br/>
                            Le montant sera déduit de votre caisse et le stock des articles sera automatiquement restauré.
                        </p>
                        
                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setReceiptToCancel(null)} className="flex-1 btn-secondary py-3">Retour</button>
                                <button 
                                    onClick={confirmCancel} 
                                    disabled={cancelReceiptMutation.isPending}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-3 transition-colors disabled:opacity-50 shadow-premium"
                                >
                                    {cancelReceiptMutation.isPending ? 'Annulation...' : 'Oui, annuler'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modify Sale Modal */}
            <AnimatePresence>
                {receiptToModify && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-panel rounded-3xl p-8 max-w-md w-full shadow-premium"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-primary">Modifier la Vente</h2>
                                <button onClick={() => setReceiptToModify(null)} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                               <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                {modifiedItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-surface dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-border-theme">
                                        <div>
                                            <p className="font-semibold text-primary text-sm">{item.name}</p>
                                            <p className="text-xs text-secondary">{item.price.toLocaleString('fr-FR')} F / unité</p>
                                        </div>
                                        <div className="flex items-center gap-1 bg-panel rounded-lg border border-slate-200 dark:border-border-theme p-1">
                                            <button
                                                onClick={() => updateModifiedQty(item.id, item.new_qty - 1)}
                                                aria-label="Diminuer la quantité"
                                                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-secondary transition-colors"
                                            ><Minus className="w-4 h-4" /></button>
                                            <span className="w-8 text-center font-bold text-primary">{item.new_qty}</span>
                                            <button
                                                onClick={() => updateModifiedQty(item.id, item.new_qty + 1)}
                                                aria-label="Augmenter la quantité"
                                                className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-accent font-bold shadow-sm transition-colors"
                                            ><Plus className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        
                        <div className="flex justify-between items-center mb-6 px-2">
                            <span className="text-secondary font-medium">Nouveau Total</span>
                            <span className="text-xl font-bold text-indigo-600">
                                {modifiedItems.reduce((acc, item) => acc + (item.new_qty * item.price), 0).toLocaleString('fr-FR')} FCFA
                            </span>
                        </div>

                            <div className="flex gap-3">
                                <button onClick={() => setReceiptToModify(null)} className="flex-1 btn-secondary py-3">Annuler</button>
                                <button 
                                    onClick={confirmModify} 
                                    disabled={modifyReceiptMutation.isPending}
                                    className="flex-1 btn-primary py-3 shadow-premium"
                                >
                                    {modifyReceiptMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold text-primary tracking-tight">Historique des ventes</h1>
                    <p className="text-secondary mt-1">Consultez vos transactions et gérez les annulations</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="px-4 py-2 rounded-full border border-slate-200 dark:border-border-theme text-sm font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        7 jours
                    </button>
                    <button className="px-4 py-2 rounded-full border border-slate-200 dark:border-border-theme text-sm font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-slate-50 dark:bg-slate-800">
                        30 jours
                    </button>
                    <button className="px-4 py-2 rounded-full border border-slate-200 dark:border-border-theme text-sm font-medium text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
                        Période <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden print:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-border-theme">
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Date & Heure</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Client</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Articles</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right">Total</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-center">Statut</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-theme">
                            {receipts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-secondary">
                                        Aucune vente enregistrée pour le moment.
                                    </td>
                                </tr>
                            ) : (
                                receipts.map(receipt => (
                                    <tr key={receipt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-primary">
                                                {new Date(receipt.created_at).toLocaleDateString('fr-FR')}
                                            </div>
                                            <div className="text-sm text-secondary">
                                                {new Date(receipt.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {receipt.customer_name ? (
                                                <div>
                                                    <div className="font-bold text-primary">{receipt.customer_name}</div>
                                                    {receipt.customer_phone && <div className="text-sm text-secondary">{receipt.customer_phone}</div>}
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-bold text-primary">Client Comptoir</div>
                                                    <div className="text-sm text-secondary italic">Passage en caisse</div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1">
                                                {receipt.sales?.map(sale => (
                                                    <div key={sale.id} className="text-sm text-secondary">
                                                        <span className="font-bold text-primary">{sale.quantity}x</span> {sale.products?.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right font-bold text-primary text-lg">
                                            {receipt.total_amount.toLocaleString('fr-FR')} F
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex flex-col gap-2 items-center">
                                                {receipt.status === 'cancelled' ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                                                        Annulé
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                        Validé
                                                    </span>
                                                )}
                                                {receipt.payment_method === 'mobile_money' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                                                        📱 Mobile Money
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                                        💵 Espèces
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                {receipt.status !== 'cancelled' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handlePrint(receipt)}
                                                            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition-colors"
                                                            title="Imprimer Facture"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleModify(receipt)}
                                                            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/20 transition-colors"
                                                            title="Modifier"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setReceiptToCancel(receipt)}
                                                            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                                                            title="Annuler Vente"
                                                        >
                                                            <Ban className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
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
