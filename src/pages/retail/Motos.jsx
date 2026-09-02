import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '../../contexts/BusinessContext';
import { useProducts } from '../../hooks/useProducts';
import { adjustStock, deleteProduct, productKeys } from '../../services/productsService';
import { Plus, Search, Edit2, Bike, Tag, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { AddProductModal } from '../../components/AddProductModal';
import { EditProductModal } from '../../components/EditProductModal';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';

export const Motos = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddMotoOpen, setIsAddMotoOpen] = useState(false);
    const [isEditMotoOpen, setIsEditMotoOpen] = useState(false);
    const [motoToEdit, setMotoToEdit] = useState(null);

    // Motos share the same `products` table/cache as Stock and Caisse — filtered
    // client-side instead of via a separate server query + cache key, so a sale
    // or stock edit made anywhere else is reflected here too without a stale cache.
    const { data: products = [], isLoading } = useProducts(selectedBusiness?.id);
    const motos = useMemo(
        () => products.filter(p => p.type === 'moto' || p.name.toLowerCase().includes('moto')),
        [products]
    );

    const filteredMotos = useMemo(
        () => motos.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [motos, searchTerm]
    );

    const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: productKeys.all(selectedBusiness?.id) });

    const updateStockMutation = useMutation({
        mutationFn: adjustStock,
        onSuccess: () => {
            invalidateProducts();
            toast.success('Stock de la moto mis à jour');
        },
        onError: () => {
            toast.error('Erreur lors de la mise à jour du stock');
        }
    });

    const deleteMotoMutation = useMutation({
        mutationFn: deleteProduct,
        onSuccess: () => {
            invalidateProducts();
            toast.success('Moto supprimée !');
        },
        onError: () => {
            toast.error('Erreur lors de la suppression de la moto.');
        }
    });

    const handleDelete = (moto) => {
        if (window.confirm('Voulez-vous vraiment supprimer cette moto ?')) {
            deleteMotoMutation.mutate({ id: moto.id, imageUrl: moto.image_url });
        }
    };

    const columns = [
        {
            key: 'model',
            header: 'Modèle',
            headerClassName: 'p-4 font-semibold border-b border-slate-100 dark:border-border-theme',
            cellClassName: 'p-4',
            render: (moto) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Bike className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <p className="font-bold text-primary">{moto.name}</p>
                        <p className="text-xs text-secondary flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Moto
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'stock',
            header: 'Quantité (Stock)',
            headerClassName: 'p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-center',
            cellClassName: 'p-4 text-center',
            render: (moto) => (
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => updateStockMutation.mutate({ id: moto.id, change: -1 })}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Diminuer le stock"
                    >
                        <MinusCircle className="w-5 h-5" />
                    </button>
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${moto.stock_quantity > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {moto.stock_quantity}
                    </span>
                    <button
                        onClick={() => updateStockMutation.mutate({ id: moto.id, change: 1 })}
                        className="text-slate-400 hover:text-emerald-500 transition-colors"
                        title="Augmenter le stock"
                    >
                        <PlusCircle className="w-5 h-5" />
                    </button>
                </div>
            ),
        },
        {
            key: 'price',
            header: 'Prix Unitaire',
            headerClassName: 'p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-right',
            cellClassName: 'p-4 text-right',
            render: (moto) => (
                <span className="font-bold text-accent">
                    {Number(moto.price).toLocaleString('fr-FR')} FCFA
                </span>
            ),
        },
        {
            key: 'margin',
            header: 'Marge',
            headerClassName: 'p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-right',
            cellClassName: 'p-4 text-right',
            render: (moto) => {
                if (moto.cost_price == null) {
                    return <span className="text-slate-400 text-sm">—</span>;
                }
                const margin = moto.price - moto.cost_price;
                return (
                    <span className={`text-sm font-semibold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {margin.toLocaleString('fr-FR')} FCFA
                    </span>
                );
            },
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-center',
            cellClassName: 'p-4 text-center',
            render: (moto) => (
                <StatusBadge
                    label={moto.stock_quantity > 0 ? 'Disponible' : 'Rupture'}
                    tone={moto.stock_quantity > 0 ? 'emerald' : 'red'}
                />
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'p-4 font-semibold border-b border-slate-100 dark:border-border-theme text-right',
            cellClassName: 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium',
            render: (moto) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => { setMotoToEdit(moto); setIsEditMotoOpen(true); }}
                        aria-label="Modifier la moto"
                        className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(moto)}
                        aria-label="Supprimer la moto"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    const emptyContent = (
        <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bike className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-secondary font-medium">Aucune moto trouvée dans le parc.</p>
            <button className="mt-4 text-accent font-medium hover:underline text-sm">
                Ajoutez votre première moto
            </button>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-primary mb-2 flex items-center gap-3">
                        <Bike className="w-8 h-8 text-accent" />
                        Parc Motos
                    </h1>
                    <p className="text-secondary font-medium">Gérez votre inventaire de deux-roues (Disponibilité, Prix).</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-premium"
                        onClick={() => setIsAddMotoOpen(true)}
                    >
                        <Plus className="w-5 h-5" /> Nouvelle Moto
                    </button>
                </div>
            </div>

            {/* Content */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden"
            >
                <div className="p-6 border-b border-slate-100 dark:border-border-theme relative flex items-center">
                    <div className="relative w-full max-w-md">
                        <input 
                            type="text" 
                            placeholder="Rechercher une moto (Modèle, Marque)..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-full py-3 px-5 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-primary placeholder:text-slate-400"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={filteredMotos}
                    isLoading={isLoading}
                    loadingContent={
                        <div className="p-10 flex justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent"></div>
                        </div>
                    }
                    emptyContent={emptyContent}
                    headerRowClassName="bg-slate-50/50 dark:bg-slate-800/30 text-secondary text-xs uppercase tracking-wider"
                    tbodyClassName=""
                    getRowClassName={() => 'hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-50 dark:border-border-theme/50 last:border-0 group'}
                    stateCellClassName="p-0"
                />
            </motion.div>
            
            <AddProductModal 
                isOpen={isAddMotoOpen} 
                onClose={() => setIsAddMotoOpen(false)} 
                defaultType="moto"
            />
            <EditProductModal 
                isOpen={isEditMotoOpen} 
                onClose={() => { setIsEditMotoOpen(false); setMotoToEdit(null); }} 
                product={motoToEdit}
            />
        </div>
    );
};
