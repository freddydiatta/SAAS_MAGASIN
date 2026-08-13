import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { AddProductModal } from '../../components/AddProductModal';
import { EditProductModal } from '../../components/EditProductModal';

export const Stock = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [isEditProductOpen, setIsEditProductOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

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
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        + Nouvel Article
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-premium overflow-hidden border border-slate-100">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <input 
                        type="text" 
                        placeholder="Rechercher un article..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field max-w-md bg-white"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="px-6 py-4">Article</th>
                                <th className="px-6 py-4">Prix Unitaire</th>
                                <th className="px-6 py-4">En Stock</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-secondary">Chargement...</td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-secondary">
                                        Aucun article trouvé. Ajoutez votre premier produit !
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-primary">
                                            {product.name}
                                        </td>
                                        <td className="px-6 py-4 text-secondary">
                                            {product.price.toLocaleString('fr-FR')} FCFA
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                                product.stock_quantity > 10 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : product.stock_quantity > 0 
                                                        ? 'bg-amber-100 text-amber-800' 
                                                        : 'bg-red-100 text-red-800'
                                            }`}>
                                                {product.stock_quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => { setProductToEdit(product); setIsEditProductOpen(true); }}
                                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                Modifier
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
