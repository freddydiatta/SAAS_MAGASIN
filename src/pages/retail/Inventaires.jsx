import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useInventories } from '../../hooks/useInventories';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { InventoryCountModal } from '../../components/InventoryCountModal';
import { Plus, ClipboardList, Trash2, PlayCircle, Eye } from 'lucide-react';

const INVENTORY_STATUS = {
    draft: { label: 'Brouillon', tone: 'amber' },
    validated: { label: 'Validé', tone: 'emerald' },
};

export const Inventaires = () => {
    const { selectedBusiness, currentMember } = useBusiness();
    const { user } = useAuth();
    // Un caissier a un compte auto-généré (email interne illisible) : on
    // journalise son nom d'affichage plutôt que cet email quand disponible.
    const actorLabel = currentMember?.name || user?.email || 'unknown';
    const {
        inventories, isLoading,
        isStartFormOpen, openStartForm, closeStartForm, note, setNote, handleStartInventory, isStartingInventory,
        activeInventory, openInventory, closeInventory, onInventoryValidated,
        confirmAction, closeConfirmAction, confirmPendingAction, isConfirmingAction, handleDeleteInventory,
    } = useInventories(selectedBusiness, actorLabel);

    const columns = [
        {
            key: 'date',
            header: 'Date',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (inv) => new Date(inv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        },
        {
            key: 'author',
            header: 'Auteur',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (inv) => inv.created_by || '—',
        },
        {
            key: 'note',
            header: 'Note',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'px-6 py-4 text-secondary text-sm',
            render: (inv) => inv.note || '—',
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-center',
            cellClassName: 'px-6 py-4 text-center',
            render: (inv) => {
                const status = INVENTORY_STATUS[inv.status] || INVENTORY_STATUS.draft;
                return <StatusBadge label={status.label} tone={status.tone} />;
            },
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'py-4 px-6',
            cellClassName: 'py-4 px-6 text-right',
            render: (inv) => (
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => openInventory(inv)}
                        title={inv.status === 'draft' ? 'Continuer le comptage' : "Voir l'inventaire"}
                        className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    >
                        {inv.status === 'draft' ? <PlayCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {inv.status === 'draft' && (
                        <button
                            onClick={() => handleDeleteInventory(inv)}
                            title="Supprimer"
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Inventaires</h1>
                    <p className="text-secondary text-sm">Comptez votre stock physique et comparez-le à ce qui est censé rester.</p>
                </div>
                <button
                    onClick={openStartForm}
                    className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-premium"
                >
                    <Plus className="w-5 h-5" /> Nouvel inventaire
                </button>
            </div>

            <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-border-theme flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-accent">
                        <ClipboardList className="w-5 h-5" />
                    </div>
                    <h2 className="font-bold text-primary">Historique des inventaires</h2>
                </div>
                <DataTable
                    columns={columns}
                    data={inventories}
                    isLoading={isLoading}
                    emptyContent="Aucun inventaire pour le moment."
                />
            </div>

            <Modal isOpen={isStartFormOpen} onClose={closeStartForm} title="Nouvel inventaire" maxWidth="max-w-sm">
                <form onSubmit={handleStartInventory} className="space-y-4">
                    <p className="text-sm text-secondary">
                        Le stock actuel de chaque article sera figé comme référence. Vous pourrez ensuite saisir le comptage physique au fur et à mesure.
                    </p>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Note (optionnel)</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            placeholder="Ex: Inventaire de septembre"
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={closeStartForm} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                            Annuler
                        </button>
                        <button type="submit" disabled={isStartingInventory} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50">
                            {isStartingInventory ? 'Démarrage...' : 'Démarrer'}
                        </button>
                    </div>
                </form>
            </Modal>

            <InventoryCountModal
                isOpen={!!activeInventory}
                onClose={closeInventory}
                inventory={activeInventory}
                actorLabel={actorLabel}
                onValidated={onInventoryValidated}
            />

            <ConfirmModal
                isOpen={!!confirmAction}
                onCancel={closeConfirmAction}
                onConfirm={confirmPendingAction}
                isConfirming={isConfirmingAction}
                title="Supprimer cet inventaire ?"
                message="Ce brouillon d'inventaire sera définitivement supprimé. Cette action est irréversible."
                confirmLabel="Oui, supprimer"
                tone="red"
            />
        </div>
    );
};
