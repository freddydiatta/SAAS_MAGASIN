import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSalesHistory } from '../../hooks/useSalesHistory';
import { InvoicePrint } from '../../components/InvoicePrint';
import { FileText, Edit2, Ban, Calendar, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';

export const HistoriqueVentes = () => {
    const { selectedBusiness, currentMember } = useBusiness();
    const { user } = useAuth();
    // Un caissier a un compte auto-généré (email interne illisible) : on
    // journalise son nom d'affichage plutôt que cet email quand disponible.
    const actorLabel = currentMember?.name || user?.email || 'unknown';

    const {
        receipts, isLoading,
        toastMessage,
        receiptToCancel, setReceiptToCancel, confirmCancel, isCancelling,
        receiptToPrint, setReceiptToPrint, handlePrint,
        receiptToModify, setReceiptToModify, modifiedItems, handleModify, updateModifiedQty, confirmModify, isModifying,
    } = useSalesHistory(selectedBusiness, actorLabel);

    if (isLoading) {
        return <div className="p-8 text-center text-secondary">Chargement de l'historique...</div>;
    }

    const columns = [
        {
            key: 'date',
            header: 'Date & Heure',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (receipt) => (
                <>
                    <div className="font-bold text-primary">
                        {new Date(receipt.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="text-sm text-secondary">
                        {new Date(receipt.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </>
            ),
        },
        {
            key: 'client',
            header: 'Client',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (receipt) => (
                receipt.customer_name ? (
                    <div>
                        <div className="font-bold text-primary">{receipt.customer_name}</div>
                        {receipt.customer_phone && <div className="text-sm text-secondary">{receipt.customer_phone}</div>}
                    </div>
                ) : (
                    <div>
                        <div className="font-bold text-primary">Client Comptoir</div>
                        <div className="text-sm text-secondary italic">Passage en caisse</div>
                    </div>
                )
            ),
        },
        {
            key: 'items',
            header: 'Articles',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (receipt) => (
                <div className="flex flex-col gap-1">
                    {receipt.sales?.map(sale => (
                        <div key={sale.id} className="text-sm text-secondary">
                            <span className="font-bold text-primary">{sale.quantity}x</span> {sale.products?.name}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            key: 'total',
            header: 'Total',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'py-4 px-6 text-right font-bold text-primary text-lg',
            render: (receipt) => `${receipt.total_amount.toLocaleString('fr-FR')} F`,
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-center',
            cellClassName: 'py-4 px-6 text-center',
            render: (receipt) => (
                <div className="flex flex-col gap-2 items-center">
                    <StatusBadge
                        label={receipt.status === 'cancelled' ? 'Annulé' : 'Validé'}
                        tone={receipt.status === 'cancelled' ? 'red' : 'emerald'}
                    />
                    <StatusBadge
                        label={
                            receipt.payment_method === 'mobile_money' ? '📱 Mobile Money'
                                : receipt.payment_method === 'credit' ? '🤝 Crédit'
                                : '💵 Espèces'
                        }
                        tone={
                            receipt.payment_method === 'mobile_money' ? 'orange'
                                : receipt.payment_method === 'credit' ? 'amber'
                                : 'blue'
                        }
                        rounded="md"
                        className="px-2 py-0.5 text-[10px]"
                    />
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'py-4 px-6 text-right',
            render: (receipt) => (
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
            ),
        },
    ];

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
            <Modal isOpen={!!receiptToCancel} onClose={() => setReceiptToCancel(null)}>
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mb-6 mx-auto">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-primary text-center mb-2">Annuler la vente ?</h2>
                <p className="text-secondary text-center mb-8">
                    Êtes-vous sûr de vouloir annuler cette transaction de <strong>{receiptToCancel?.total_amount.toLocaleString('fr-FR')} FCFA</strong> ?<br/><br/>
                    Le montant sera déduit de votre caisse et le stock des articles sera automatiquement restauré.
                </p>
                <div className="flex gap-3 mt-8">
                    <button onClick={() => setReceiptToCancel(null)} className="flex-1 btn-secondary py-3">Retour</button>
                    <button
                        onClick={confirmCancel}
                        disabled={isCancelling}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-3 transition-colors disabled:opacity-50 shadow-premium"
                    >
                        {isCancelling ? 'Annulation...' : 'Oui, annuler'}
                    </button>
                </div>
            </Modal>

            {/* Modify Sale Modal */}
            <Modal isOpen={!!receiptToModify} onClose={() => setReceiptToModify(null)} title="Modifier la Vente">
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
                        disabled={isModifying}
                        className="flex-1 btn-primary py-3 shadow-premium"
                    >
                        {isModifying ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </Modal>

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
                <DataTable
                    columns={columns}
                    data={receipts}
                    keyField="id"
                    emptyContent="Aucune vente enregistrée pour le moment."
                />
            </div>
        </div>
    );
};
