import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { useRestaurantOrders } from '../../hooks/useRestaurantOrders';
import { ShoppingBag, Minus, Plus, Utensils, Receipt, ClipboardList, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DataTable } from '../../components/DataTable';
import { restaurantOrderSchema, firstZodError } from '../../lib/validation';
import { StatusBadge } from '../../components/StatusBadge';
import { ORDER_STATUS } from '../../lib/orderStatus';

export const Commandes = () => {
    const { selectedBusiness } = useBusiness();
    const [view, setView] = useState('new'); // 'new' | 'orders'

    const [cart, setCart] = useState([]);
    const [tableNumber, setTableNumber] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    const { data: menuItems = [], isLoading } = useQuery({
        queryKey: ['menuItems', selectedBusiness?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('menu_items')
                .select('*')
                .eq('business_id', selectedBusiness?.id)
                .eq('is_available', true)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!selectedBusiness
    });

    const {
        orders,
        loadingOrders,
        activeOrders,
        createOrder,
        isCreatingOrder,
        setOrderStatus,
    } = useRestaurantOrders(selectedBusiness);

    const filteredItems = useMemo(
        () => selectedCategory === 'all' ? menuItems : menuItems.filter(item => item.category === selectedCategory),
        [menuItems, selectedCategory]
    );

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) {
            setCart(prev => prev.filter(item => item.id !== productId));
            return;
        }
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
        ));
    };

    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    const handleCheckout = () => {
        if (cart.length === 0) return;

        const result = restaurantOrderSchema.safeParse({ tableNumber });
        if (!result.success) {
            toast.error(firstZodError(result));
            return;
        }

        createOrder({
            items: cart.map(item => ({ menu_item_id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
            total: cartTotal,
            tableNumber: result.data.tableNumber
        }, {
            onSuccess: () => {
                setCart([]);
                setTableNumber('');
            }
        });
    };

    const categories = [
        { id: 'all', label: 'Tout' },
        { id: 'entree', label: 'Entrées' },
        { id: 'plat', label: 'Plats' },
        { id: 'dessert', label: 'Desserts' },
        { id: 'boisson', label: 'Boissons' },
    ];

    const orderColumns = [
        {
            key: 'table',
            header: 'Table / Client',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 font-bold text-primary',
            render: (order) => order.table_number || 'À emporter',
        },
        {
            key: 'items',
            header: 'Articles',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6',
            render: (order) => (
                <div className="flex flex-col gap-1">
                    {(order.items || []).map((item, idx) => (
                        <div key={idx} className="text-sm text-secondary">
                            <span className="font-bold text-primary">{item.quantity}x</span> {item.name}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            key: 'total',
            header: 'Total',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'py-4 px-6 text-right font-bold text-primary',
            render: (order) => `${Number(order.total_amount).toLocaleString('fr-FR')} F`,
        },
        {
            key: 'time',
            header: 'Heure',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider',
            cellClassName: 'py-4 px-6 text-secondary text-sm',
            render: (order) => new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
        {
            key: 'status',
            header: 'Statut',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-center',
            cellClassName: 'py-4 px-6 text-center',
            render: (order) => {
                const status = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
                return <StatusBadge label={status.label} tone={status.tone} />;
            },
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'py-4 px-6 font-semibold text-secondary text-xs uppercase tracking-wider text-right',
            cellClassName: 'py-4 px-6 text-right',
            render: (order) => {
                if (order.status === 'pending') {
                    return (
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setOrderStatus(order.id, 'served')}
                                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-colors"
                                title="Marquer servie"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setOrderStatus(order.id, 'cancelled')}
                                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                                title="Annuler la commande"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    );
                }
                if (order.status === 'served') {
                    return (
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setOrderStatus(order.id, 'paid')}
                                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition-colors"
                                title="Marquer payée"
                            >
                                <CreditCard className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setOrderStatus(order.id, 'cancelled')}
                                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                                title="Annuler la commande"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    );
                }
                return <span className="text-slate-300 dark:text-slate-600">—</span>;
            },
        },
    ];

    return (
        <div className="animate-fade-in-up space-y-4">
            <div className="flex gap-2">
                <button
                    onClick={() => setView('new')}
                    className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${
                        view === 'new' ? 'bg-accent text-white shadow-premium' : 'bg-surface text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-border-theme'
                    }`}
                >
                    <Receipt className="w-4 h-4" /> Nouvelle Commande
                </button>
                <button
                    onClick={() => setView('orders')}
                    className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${
                        view === 'orders' ? 'bg-accent text-white shadow-premium' : 'bg-surface text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-border-theme'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" /> Commandes en cours
                    {activeOrders.length > 0 && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{activeOrders.length}</span>
                    )}
                </button>
            </div>

            {view === 'orders' ? (
                <div className="bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden">
                    <DataTable
                        columns={orderColumns}
                        data={orders}
                        isLoading={loadingOrders}
                        emptyContent="Aucune commande pour le moment."
                    />
                </div>
            ) : (
            <div className="h-[calc(100vh-12rem)] flex flex-col md:flex-row gap-6">
                {/* Left side: Menu Items Grid */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 flex flex-col bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme overflow-hidden"
                >
                    <div className="p-4 border-b border-slate-100 dark:border-border-theme bg-slate-50/50 dark:bg-slate-800/20 flex gap-2 overflow-x-auto custom-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                                    selectedCategory === cat.id
                                        ? 'bg-accent text-white shadow-premium'
                                        : 'bg-surface text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-border-theme'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
                                <Utensils className="w-12 h-12 opacity-50" />
                                <p>Aucun plat dans cette catégorie.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredItems.map(item => (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="relative rounded-2xl text-left border border-slate-100 dark:border-border-theme hover:border-accent/50 bg-surface cursor-pointer transition-colors group flex flex-col overflow-hidden h-full"
                                    >
                                        {item.image_url && (
                                            <img src={item.image_url} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
                                        )}
                                        <div className="p-5 flex-1 flex flex-col justify-between min-h-[90px]">
                                            <div className="font-bold text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors">{item.name}</div>
                                            <div className="text-accent font-black text-lg">{item.price.toLocaleString('fr-FR')} F</div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Right side: Ticket / Order */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full md:w-96 bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme flex flex-col overflow-hidden shrink-0"
                >
                    <div className="p-6 border-b border-slate-100 dark:border-border-theme bg-accent text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                        <h2 className="text-xl font-bold flex items-center gap-2 relative z-10"><Receipt className="w-5 h-5" /> Nouveau Ticket</h2>
                        <input
                            type="text"
                            placeholder="Table N° ou Client..."
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            maxLength={50}
                            className="mt-4 w-full px-4 py-3 bg-white/20 text-white placeholder-white/60 rounded-xl outline-none focus:bg-white/30 transition-colors backdrop-blur-sm relative z-10"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
                                <ShoppingBag className="w-12 h-12 opacity-50" />
                                <p>Aucun plat sélectionné</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {cart.map(item => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                                        key={item.id}
                                        className="flex justify-between items-center group bg-surface p-3 rounded-2xl border border-slate-100 dark:border-border-theme"
                                    >
                                        <div className="flex-1 pr-2">
                                            <div className="font-bold text-primary text-sm line-clamp-1">{item.name}</div>
                                            <div className="text-xs text-accent font-bold mt-0.5">{item.price.toLocaleString('fr-FR')} F</div>
                                        </div>
                                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-1">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                aria-label="Diminuer la quantité"
                                                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-primary flex items-center justify-center shadow-sm transition-colors"
                                            ><Minus className="w-3 h-3" /></button>
                                            <span className="w-4 text-center font-bold text-primary text-sm">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                aria-label="Augmenter la quantité"
                                                className="w-7 h-7 rounded-lg bg-accent text-white hover:bg-accent-hover flex items-center justify-center shadow-sm transition-colors"
                                            ><Plus className="w-3 h-3" /></button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-100 dark:border-border-theme bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-secondary font-medium">Total TTC</span>
                            <span className="text-2xl font-black text-accent">{cartTotal.toLocaleString('fr-FR')} F</span>
                        </div>
                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || isCreatingOrder}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                                cart.length === 0
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    : 'bg-accent text-white hover:bg-accent-hover shadow-premium active:scale-95'
                            }`}
                        >
                            {isCreatingOrder ? 'Envoi...' : 'Envoyer la commande'}
                        </button>
                    </div>
                </motion.div>
            </div>
            )}
        </div>
    );
};
