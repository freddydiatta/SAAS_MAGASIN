import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '../../contexts/BusinessContext';
import { useProducts } from '../../hooks/useProducts';
import { adjustStock, deleteProduct, productKeys } from '../../services/productsService';
import { AddProductModal } from '../../components/AddProductModal';
import { EditProductModal } from '../../components/EditProductModal';
import { Plus, Search, Edit2, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

export const Stock = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [isEditProductOpen, setIsEditProductOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: products = [], isLoading } = useProducts(selectedBusiness?.id);

    const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: productKeys.all(selectedBusiness?.id) });

    const updateStockMutation = useMutation({
        // Ajustement atomique côté base de données (évite la race condition
        // d'un "lire le stock puis écrire" fait depuis le client en cas de
        // clics concurrents, voir adjust_stock dans
        // supabase/patches/2026-08-21_critical_fixes.sql).
        mutationFn: adjustStock,
        onSuccess: () => {
            invalidateProducts();
            toast.success('Stock mis à jour');
        },
        onError: () => {
            toast.error('Erreur lors de la mise à jour du stock');
        }
    });

    const deleteProductMutation = useMutation({
        mutationFn: deleteProduct,
        onSuccess: () => {
            invalidateProducts();
            toast.success('Produit supprimé !');
        },
        onError: () => {
            toast.error('Erreur lors de la suppression.');
        }
    });

    const handleDelete = (id) => {
        if (window.confirm('Voulez-vous vraiment supprimer ce produit ?')) {
            deleteProductMutation.mutate(id);
        }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">Gestion du Stock</h1>
                    <p className="text-secondary text-sm">Gérez vos articles, prix et quantités.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsAddProductOpen(true)}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-premium"
                    >
                        <Plus className="w-5 h-5" /> Nouvel Article
                    </button>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden"
            >
                <div className="p-6 border-b border-slate-100 dark:border-border-theme relative">
                    <input 
                        type="text" 
                        placeholder="Rechercher un article..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-md bg-surface border border-slate-200 dark:border-border-theme rounded-full py-3 px-5 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary placeholder:text-slate-400"
                    />
                    <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-border-theme">
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Article</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">Prix Unitaire</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider">En Stock</th>
                                <th className="py-5 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-theme">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-secondary">Chargement...</td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-secondary">
                                        Aucun article trouvé. Ajoutez votre premier produit !
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-primary">
                                            {product.name}
                                        </td>
                                        <td className="px-6 py-4 text-secondary font-medium">
                                            {product.price.toLocaleString('fr-FR')} F
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => updateStockMutation.mutate({ id: product.id, change: -1 })}
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Diminuer de 1"
                                                >
                                                    <MinusCircle className="w-5 h-5" />
                                                </button>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                                    product.stock_quantity > 10 
                                                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                                        : product.stock_quantity > 0 
                                                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' 
                                                            : 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                                                }`}>
                                                    {product.stock_quantity}
                                                </span>
                                                <button 
                                                    onClick={() => updateStockMutation.mutate({ id: product.id, change: 1 })}
                                                    className="text-slate-400 hover:text-emerald-500 transition-colors"
                                                    title="Ajouter 1"
                                                >
                                                    <PlusCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => { setProductToEdit(product); setIsEditProductOpen(true); }}
                                                    className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/20 transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(product.id)}
                                                    className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            <AddProductModal 
                isOpen={isAddProductOpen} 
                onClose={() => setIsAddProductOpen(false)} 
            />
            <EditProductModal 
                isOpen={isEditProductOpen} 
                onClose={() => { setIsEditProductOpen(false); setProductToEdit(null); }} 
                product={productToEdit}
            />
        </div>
    );
};
