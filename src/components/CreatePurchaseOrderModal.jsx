import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { useProducts } from '../hooks/useProducts';
import { Modal } from './Modal';

// Sentinelle choisie dans le <select> produit pour basculer la ligne en mode
// "nouveau produit" : on commande souvent un article qu'on n'a encore jamais
// vendu, il ne doit pas falloir aller le créer dans Stock avant de pouvoir
// passer la commande.
const NEW_PRODUCT_VALUE = '__new__';

const EMPTY_ITEM = {
    productId: '',
    // 'unit' : quantité + prix d'achat directement à l'unité (comportement
    // historique). 'pack' : on connaît le nombre de packs, le nombre
    // d'unités par pack et le prix du pack — la quantité et le prix d'achat
    // unitaire (ce qui alimente le stock et cost_price) sont calculés.
    mode: 'unit',
    quantity: 1,
    unitCost: '',
    packCount: 1,
    unitsPerPack: '',
    packCost: '',
    newProductName: '',
    newProductPrice: '',
};

// Quantité en unités et prix d'achat unitaire réellement envoyés à la
// commande, quel que soit le mode de saisie choisi pour cette ligne.
const resolveQuantityAndCost = (item) => {
    if (item.mode === 'pack') {
        const packs = Number(item.packCount) || 0;
        const perPack = Number(item.unitsPerPack) || 0;
        const packCost = Number(item.packCost) || 0;
        return {
            quantity: packs * perPack,
            unitCost: perPack > 0 ? packCost / perPack : 0,
        };
    }
    return { quantity: Number(item.quantity) || 0, unitCost: Number(item.unitCost) || 0 };
};

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
    // 1 du suivi fournisseurs) — modifiable si le prix négocié cette fois
    // diffère. Ne s'applique qu'en mode "unité" : on ne connaît pas le
    // nombre d'unités par pack de ce produit pour retrouver un prix de pack.
    const handleProductChange = (index, productId) => {
        if (productId === NEW_PRODUCT_VALUE) {
            updateItem(index, { productId, unitCost: '', newProductName: '', newProductPrice: '' });
            return;
        }
        const product = products.find((p) => p.id === productId);
        updateItem(index, { productId, unitCost: product?.cost_price ?? '' });
    };

    const addItemRow = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    const removeItemRow = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

    const total = items.reduce((sum, item) => {
        const { quantity, unitCost } = resolveQuantityAndCost(item);
        return sum + quantity * unitCost;
    }, 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            supplierId,
            items: items.map((item) => {
                const { quantity, unitCost } = resolveQuantityAndCost(item);
                if (item.productId === NEW_PRODUCT_VALUE) {
                    return {
                        isNew: true,
                        newProduct: { name: item.newProductName.trim(), price: Number(item.newProductPrice) },
                        quantity,
                        unitCost,
                    };
                }
                return { productId: item.productId, quantity, unitCost };
            }),
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
                    {items.map((item, index) => {
                        const { quantity: resolvedQuantity, unitCost: resolvedUnitCost } = resolveQuantityAndCost(item);
                        return (
                            <div key={index} className="rounded-xl border border-slate-100 dark:border-border-theme p-3 space-y-2">
                                <div className="flex gap-2 items-center">
                                    <select
                                        required
                                        value={item.productId}
                                        onChange={(e) => handleProductChange(index, e.target.value)}
                                        className="flex-1 min-w-0 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                    >
                                        <option value="">Choisir un produit</option>
                                        <option value={NEW_PRODUCT_VALUE}>+ Créer un nouveau produit</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>{product.name}</option>
                                        ))}
                                    </select>
                                    <div className="flex rounded-lg border border-slate-300 dark:border-border-theme overflow-hidden text-sm shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => updateItem(index, { mode: 'unit' })}
                                            className={`px-3 py-2 font-medium transition-colors ${item.mode === 'unit' ? 'bg-accent text-white' : 'bg-surface text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                        >
                                            Unité
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateItem(index, { mode: 'pack' })}
                                            className={`px-3 py-2 font-medium transition-colors ${item.mode === 'pack' ? 'bg-accent text-white' : 'bg-surface text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                        >
                                            Pack
                                        </button>
                                    </div>
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

                                {item.mode === 'unit' ? (
                                    <div className="flex gap-2 items-center pl-1">
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            step="1"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, { quantity: e.target.value })}
                                            className="w-24 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                            placeholder="Qté"
                                        />
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="1"
                                            value={item.unitCost}
                                            onChange={(e) => updateItem(index, { unitCost: e.target.value })}
                                            className="w-32 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                            placeholder="P.U. achat"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 items-center pl-1">
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            step="1"
                                            value={item.packCount}
                                            onChange={(e) => updateItem(index, { packCount: e.target.value })}
                                            className="w-24 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                            placeholder="Nb de packs"
                                        />
                                        <span className="text-secondary text-sm">×</span>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            step="1"
                                            value={item.unitsPerPack}
                                            onChange={(e) => updateItem(index, { unitsPerPack: e.target.value })}
                                            className="w-28 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                            placeholder="Unités/pack"
                                        />
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="1"
                                            value={item.packCost}
                                            onChange={(e) => updateItem(index, { packCost: e.target.value })}
                                            className="w-28 bg-surface border border-slate-300 dark:border-border-theme rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary"
                                            placeholder="Prix du pack"
                                        />
                                        {resolvedQuantity > 0 && (
                                            <span className="text-xs text-secondary">
                                                = {resolvedQuantity} unité{resolvedQuantity > 1 ? 's' : ''} à {resolvedUnitCost.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} F/unité
                                            </span>
                                        )}
                                    </div>
                                )}

                                {item.productId === NEW_PRODUCT_VALUE && (
                                    <div className="flex gap-2 items-center pl-1">
                                        <input
                                            type="text"
                                            required
                                            value={item.newProductName}
                                            onChange={(e) => updateItem(index, { newProductName: e.target.value })}
                                            className="flex-1 min-w-0 bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-700"
                                            placeholder="Nom du nouveau produit"
                                        />
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="1"
                                            value={item.newProductPrice}
                                            onChange={(e) => updateItem(index, { newProductPrice: e.target.value })}
                                            className="w-32 bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-emerald-700"
                                            placeholder="Prix de vente"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
