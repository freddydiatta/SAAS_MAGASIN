import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { fetchInventoryItems, saveInventoryCounts, validateInventory } from '../services/inventoriesService';

const toDisplayValue = (raw) => (raw === '' || raw === undefined || raw === null ? null : Number(raw));

export const InventoryCountModal = ({ isOpen, onClose, inventory, onValidated }) => {
    const queryClient = useQueryClient();
    const isDraft = inventory?.status === 'draft';
    const itemsQueryKey = ['inventory_items', inventory?.id];

    const { data: items = [], isLoading } = useQuery({
        queryKey: itemsQueryKey,
        queryFn: () => fetchInventoryItems(inventory.id),
        enabled: isOpen && !!inventory?.id,
    });

    const [counts, setCounts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    // L'app rafraîchit les requêtes en arrière-plan toutes les 15s
    // (queryClient.refetchInterval) — sans ce garde-fou, chaque refetch de
    // itemsQueryKey réinitialiserait counts pendant que l'utilisateur est
    // en train de saisir, effaçant sa frappe en cours (même piège que la
    // boucle de focus des modales, voir Modal.jsx). On ne (ré)initialise
    // donc qu'une fois par ouverture pour un inventaire donné, jamais sur
    // un refetch survenant pendant que la modale reste ouverte.
    const loadedForIdRef = useRef(null);
    useEffect(() => {
        if (!isOpen || !inventory?.id) {
            loadedForIdRef.current = null;
            return;
        }
        if (isLoading) return;
        if (loadedForIdRef.current === inventory.id) return;
        setCounts(Object.fromEntries(items.map((item) => [item.id, item.counted_quantity ?? ''])));
        setSearchTerm('');
        loadedForIdRef.current = inventory.id;
    }, [isOpen, inventory?.id, isLoading, items]);

    const handleCountChange = (itemId, value) => setCounts((prev) => ({ ...prev, [itemId]: value }));

    const filteredItems = useMemo(
        () => items.filter((item) => item.product_name.toLowerCase().includes(searchTerm.toLowerCase())),
        [items, searchTerm]
    );

    const buildChangedItems = () => items
        .filter((item) => toDisplayValue(counts[item.id]) !== (item.counted_quantity ?? null))
        .map((item) => ({ id: item.id, countedQuantity: toDisplayValue(counts[item.id]) }));

    const saveMutation = useMutation({
        mutationFn: saveInventoryCounts,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: itemsQueryKey });
        },
        onError: (error) => toast.error(error.message || "Erreur lors de l'enregistrement du comptage."),
    });

    const validateMutation = useMutation({
        mutationFn: () => validateInventory({ inventoryId: inventory.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: itemsQueryKey });
            onValidated?.();
            toast.success('Inventaire validé, stock mis à jour.');
            onClose();
        },
        onError: (error) => toast.error(error.message || "Erreur lors de la validation de l'inventaire."),
    });

    const handleSaveCounts = async () => {
        const changed = buildChangedItems();
        if (changed.length === 0) {
            toast.error('Rien de nouveau à enregistrer.');
            return;
        }
        await saveMutation.mutateAsync(changed);
        toast.success('Comptage enregistré.');
    };

    const handleValidate = async () => {
        const changed = buildChangedItems();
        if (changed.length > 0) {
            await saveMutation.mutateAsync(changed);
        }
        validateMutation.mutate();
    };

    const isSaving = saveMutation.isPending;
    const isValidating = validateMutation.isPending;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isDraft ? 'Comptage de l\'inventaire' : 'Inventaire (validé)'}
            maxWidth="max-w-3xl"
            panelClassName="bg-panel rounded-3xl p-8 shadow-premium max-h-[85vh] flex flex-col"
        >
            <div className="shrink-0 mb-4">
                <div className="relative max-w-sm">
                    <input
                        type="text"
                        placeholder="Rechercher un article..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-full py-2.5 px-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-slate-400"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 dark:border-border-theme">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-secondary text-xs uppercase tracking-wider sticky top-0">
                        <tr>
                            <th className="p-3 text-left font-semibold">Article</th>
                            <th className="p-3 text-center font-semibold">Théorique</th>
                            <th className="p-3 text-center font-semibold">Compté</th>
                            <th className="p-3 text-center font-semibold">Écart</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} className="p-6 text-center text-secondary">Chargement...</td></tr>
                        ) : filteredItems.length === 0 ? (
                            <tr><td colSpan={4} className="p-6 text-center text-secondary">Aucun article.</td></tr>
                        ) : filteredItems.map((item) => {
                            const counted = toDisplayValue(counts[item.id]);
                            const diff = counted === null ? null : counted - item.expected_quantity;
                            return (
                                <tr key={item.id} className="border-b border-slate-50 dark:border-border-theme/50 last:border-0">
                                    <td className="p-3 font-bold text-primary">{item.product_name}</td>
                                    <td className="p-3 text-center text-secondary">{item.expected_quantity}</td>
                                    <td className="p-3 text-center">
                                        {isDraft ? (
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={counts[item.id] ?? ''}
                                                onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                className="w-20 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                                placeholder="—"
                                            />
                                        ) : (
                                            <span className="text-primary font-semibold">{item.counted_quantity ?? '—'}</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {diff === null ? (
                                            <span className="text-slate-400">—</span>
                                        ) : diff === 0 ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0</span>
                                        ) : (
                                            <span className={`font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
                                                {diff > 0 ? `+${diff}` : diff}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isDraft ? (
                <div className="shrink-0 pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={handleSaveCounts}
                        disabled={isSaving || isValidating}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-primary bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? 'Enregistrement...' : 'Enregistrer le comptage'}
                    </button>
                    <button
                        type="button"
                        onClick={handleValidate}
                        disabled={isSaving || isValidating}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {isValidating ? 'Validation...' : "Valider l'inventaire"}
                    </button>
                </div>
            ) : (
                <div className="shrink-0 pt-4 text-xs text-secondary text-center">
                    Inventaire validé — le stock a déjà été ajusté en conséquence.
                </div>
            )}
        </Modal>
    );
};
