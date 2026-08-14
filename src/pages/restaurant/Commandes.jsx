import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { ShoppingBag, Minus, Plus, Search, Utensils, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Commandes = () => {
    const { selectedBusiness } = useBusiness();
    const queryClient = useQueryClient();
    
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

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            const { data, error } = await supabase
                .from('restaurant_orders')
                .insert([{
                    business_id: selectedBusiness.id,
                    table_number: orderData.tableNumber || 'À emporter',
                    total_amount: orderData.total,
                    status: 'pending',
                    items: orderData.items // JSONB column
                }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['restaurant_orders']);
            setCart([]);
            setTableNumber('');
            alert('Commande envoyée en cuisine !');
        }
    });

    const filteredItems = selectedCategory === 'all' 
        ? menuItems 
        : menuItems.filter(item => item.category === selectedCategory);

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
        
        createOrderMutation.mutate({
            items: cart.map(item => ({ menu_item_id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
            total: cartTotal,
            tableNumber
        });
    };

    const categories = [
        { id: 'all', label: 'Tout' },
        { id: 'entree', label: 'Entrées' },
        { id: 'plat', label: 'Plats' },
        { id: 'dessert', label: 'Desserts' },
        { id: 'boisson', label: 'Boissons' },
    ];

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6 animate-fade-in-up">
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
                                    className="relative p-5 rounded-2xl text-left border border-slate-100 dark:border-border-theme hover:border-accent/50 bg-surface cursor-pointer transition-colors group flex flex-col justify-between h-full min-h-[120px]"
                                >
                                    <div className="font-bold text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors">{item.name}</div>
                                    <div className="text-accent font-black text-lg">{item.price.toLocaleString('fr-FR')} F</div>
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
                                            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-primary flex items-center justify-center shadow-sm transition-colors"
                                        ><Minus className="w-3 h-3" /></button>
                                        <span className="w-4 text-center font-bold text-primary text-sm">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
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
                        disabled={cart.length === 0 || createOrderMutation.isPending}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                            cart.length === 0 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                                : 'bg-accent text-white hover:bg-accent-hover shadow-premium active:scale-95'
                        }`}
                    >
                        {createOrderMutation.isPending ? 'Envoi...' : 'Envoyer la commande'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
