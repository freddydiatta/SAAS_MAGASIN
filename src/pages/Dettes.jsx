import { useBusiness } from '../contexts/BusinessContext';
import { useDebts } from '../hooks/useDebts';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Plus, Trash2, CheckCircle2, HandCoins } from 'lucide-react';

const formatFCFA = (amount) => Number(amount).toLocaleString('fr-FR');

export const Dettes = () => {
    const { selectedBusiness } = useBusiness();
    const {
        debts, unpaidDebts, totalOwed, isLoading,
        isAddOpen, openAddForm, closeForm,
        formData, setFormData,
        handleSubmit, handleMarkPaid, handleDelete, isSaving,
    } = useDebts(selectedBusiness);

    const columns = [
        {
            key: 'date',
            header: 'Date',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 text-secondary text-sm',
            render: (debt) => new Date(debt.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        },
        {
            key: 'customer',
            header: 'Client',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 font-bold text-primary',
            render: (debt) => (
                <div>
                    <p>{debt.customer_name}</p>
                    {debt.customer_phone && <p className="text-xs font-normal text-secondary">{debt.customer_phone}</p>}
                </div>
            ),
        },
        {
            key: 'note',
            header: 'Description',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 text-secondary text-sm',
            render: (debt) => debt.note || '—',
        },
        {
            key: 'amount',
            header: 'Montant',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'py-4 px-6 text-right font-bold text-primary',
            render: (debt) => `${formatFCFA(debt.amount)} F`,
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-center',
            cellClassName: 'py-4 px-6 text-center',
            render: (debt) => (
                <StatusBadge
                    label={debt.status === 'paid' ? 'Remboursé' : 'Non remboursé'}
                    tone={debt.status === 'paid' ? 'emerald' : 'amber'}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'py-4 px-6',
            cellClassName: 'py-4 px-6 text-right',
            render: (debt) => (
                <div className="flex justify-end gap-2">
                    {debt.status !== 'paid' && (
                        <button
                            onClick={() => handleMarkPaid(debt)}
                            title="Marquer comme remboursé"
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => handleDelete(debt)}
                        aria-label="Supprimer la dette"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Dettes clients</h1>
                    <p className="text-secondary text-sm">Qui vous doit de l'argent, combien, et depuis quand.</p>
                </div>
                <button onClick={openAddForm} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Nouvelle dette
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <HandCoins className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium">Total dû actuellement</p>
                        <h3 className="text-2xl font-bold text-primary">{formatFCFA(totalOwed)} <span className="text-sm">FCFA</span></h3>
                    </div>
                </div>
                <div className="bg-panel rounded-3xl p-6 shadow-premium border border-slate-100 dark:border-border-theme flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-secondary">
                        <HandCoins className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium">Dettes en cours</p>
                        <h3 className="text-2xl font-bold text-primary">{unpaidDebts.length}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <DataTable
                    columns={columns}
                    data={debts}
                    isLoading={isLoading}
                    emptyContent="Aucune dette enregistrée pour le moment."
                />
            </div>

            <Modal isOpen={isAddOpen} onClose={closeForm} title="Nouvelle dette" maxWidth="max-w-sm">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Nom du client</label>
                        <input
                            type="text"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: Moussa Diop"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Téléphone (optionnel)</label>
                        <input
                            type="text"
                            value={formData.customerPhone}
                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: 77 123 45 67"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Montant (FCFA)</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: 5000"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Description (optionnel)</label>
                        <input
                            type="text"
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: Prise à crédit le 2 sept."
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={closeForm} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                            Annuler
                        </button>
                        <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50">
                            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
