import { useState, useEffect } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { useQueryClient } from '@tanstack/react-query';
import { updateProduct, productKeys } from '../services/productsService';

export const EditProductModal = ({ isOpen, onClose, product }) => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [addQuantity, setAddQuantity] = useState('');
    
    const [type, setType] = useState('standard');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (product && isOpen) {
            setName(product.name || '');
            setPrice(product.price || '');
            setQuantity(product.stock_quantity || '');
            setAddQuantity('');
            setType(product.type || 'standard');
        }
    }, [product, isOpen]);

    if (!isOpen || !product) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await updateProduct({
                id: product.id,
                name,
                type,
                price: parseFloat(price),
                stockQuantity: parseInt(quantity, 10)
            });

            // Rafraîchir les produits
            queryClient.invalidateQueries({ queryKey: productKeys.all(selectedBusiness.id) });
            
            // Fermer
            onClose();
            
        } catch (err) {
            console.error('Error updating product:', err.message);
            setError(err.message || "Erreur lors de la modification du produit.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold text-primary">Modifier Produit</h3>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Nom du produit / pièce</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Prix (FCFA)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5 flex items-center justify-between">
                                Ajouter au stock (+)
                            </label>
                            <input
                                type="number"
                                step="1"
                                placeholder="ex: 100"
                                value={addQuantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setAddQuantity(val);
                                    const base = product?.stock_quantity || 0;
                                    if (val === '') {
                                        setQuantity(base);
                                    } else {
                                        setQuantity(base + parseInt(val || 0, 10));
                                    }
                                }}
                                className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-emerald-300 text-emerald-700 font-bold"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-primary mb-1.5 flex justify-between">
                                <span>Quantité finale en stock</span>
                                <span className="text-slate-400 font-normal">Ancien stock : {product?.stock_quantity || 0}</span>
                            </label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                value={quantity}
                                onChange={(e) => {
                                    setQuantity(e.target.value);
                                    setAddQuantity(''); // Reset add if manually changed
                                }}
                                className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50 text-lg font-bold"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-accent hover:bg-accentHover shadow-md transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'Mise à jour...' : 'Mettre à jour'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
