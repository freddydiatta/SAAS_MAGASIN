import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { useProducts } from '../hooks/useProducts';
import { Modal } from './Modal';

const EMPTY_ITEM = { productId: '', quantity: 1, unitCost: '' };

export const CreatePurchaseOrderModal = ({ isOpen, onClose, onSubmit, isSaving, suppliers = [] }) => {
    const { selectedBusiness } = useBusiness();
    const { data: products = [] } = useProducts(selectedBusiness?.id);

    const [supplierId, setSupplierId] = useState('');
    const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

    const reset = () => {
        setSupplierId('');
        setItems([{ ...EMPTY_ITEM }]);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const updateItem = (index, patch) => {
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    };

    // Pré-remplit le prix d'achat avec celui déjà connu du produit (cf. étape
    // 1 du suivi fournisseurs) — modifiable si le prix négocié cette fois diffère.
    const handleProductChange = (index, productId) => {
        const product = products.find((p) => p.id === productId);
        updateItem(index, { productId, unitCost: product?.cost_price ?? '' });
    };

    const addItemRow = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    const removeItemRow = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

    const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            supplierId,
            items: items.map((item) => ({
                productId: item.productId,
                quantity: Number(item.quantity),
                unitCost: Number(item.unitCost),
            })),
        });
        reset();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Nouveau bon de commande" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-primary mb-1.5">Fournisseur (optionnel)</label>
                    <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        className="w-full bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                    >
                        <option value="">Aucun</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-primary">Articles</label>
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <select
                                required
                                value={item.productId}
                                onChange={(e) => handleProductChange(index, e.target.value)}
                                className="flex-1 min-w-0 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                            >
                                <option value="">Choisir un produit</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>{product.name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                required
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                                className="w-20 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                placeholder="Qté"
                            />
                            <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                value={item.unitCost}
                                onChange={(e) => updateItem(index, { unitCost: e.target.value })}
                                className="w-28 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                placeholder="P.U. achat"
                            />
                            <button
                                type="button"
                                onClick={() => removeItemRow(index)}
                                disabled={items.length === 1}
                                aria-label="Retirer cet article"
                                className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addItemRow}
                        className="text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Ajouter un article
                    </button>
                </div>

                <div className="pt-2 flex items-center justify-between text-sm border-t border-slate-100 dark:border-border-theme">
                    <span className="text-secondary pt-2">Total estimé</span>
                    <span className="font-bold text-primary text-lg pt-2">{total.toLocaleString('fr-FR')} FCFA</span>
                </div>

                <div className="pt-2 flex gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover shadow-md transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Création...' : 'Créer le bon de commande'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
