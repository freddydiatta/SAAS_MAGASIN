import { useState } from 'react';
import { useBusiness } from '../contexts/BusinessContext';
import { useQueryClient } from '@tanstack/react-query';
import { addProduct, productKeys } from '../services/productsService';
import { Modal } from './Modal';
import { ImageUploadField } from './ImageUploadField';
import { productSchema, firstZodError } from '../lib/validation';

export const AddProductModal = ({ isOpen, onClose, defaultType = 'standard' }) => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const [type, setType] = useState(defaultType);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const result = productSchema.safeParse({ name, price, quantity });
        if (!result.success) {
            setError(firstZodError(result));
            return;
        }

        setIsLoading(true);
        try {
            await addProduct({
                businessId: selectedBusiness.id,
                name: result.data.name,
                type,
                price: result.data.price,
                stockQuantity: result.data.quantity,
                imageUrl,
            });

            // Rafraîchir les produits
            queryClient.invalidateQueries({ queryKey: productKeys.all(selectedBusiness.id) });

            // Fermer et reset
            setName('');
            setPrice('');
            setQuantity('');
            setImageUrl('');
            onClose();

        } catch (err) {
            console.error('Error adding product:', err.message);
            setError(err.message || "Erreur lors de l'ajout du produit.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            panelClassName="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-primary">Nouveau Produit</h3>
                <button
                    onClick={onClose}
                    aria-label="Fermer"
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

                <ImageUploadField businessId={selectedBusiness?.id} value={imageUrl} onChange={setImageUrl} />

                <div>
                    <label className="block text-sm font-semibold text-primary mb-1.5">Nom du produit / pièce</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        placeholder="Ex: Plaquette de frein"
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
                            placeholder="5000"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-1.5">Quantité initiale</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
                            placeholder="10"
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
                        {isLoading ? 'Ajout...' : 'Ajouter'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
