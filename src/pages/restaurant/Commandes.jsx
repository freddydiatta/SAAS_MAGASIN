import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';

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
        <div className="h-[calc(100vh-6rem)] flex gap-6 animate-fade-in-up">
            {/* Left side: Menu Items Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-2 overflow-x-auto">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                                selectedCategory === cat.id 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <p className="text-secondary text-center py-8">Chargement du menu...</p>
                    ) : filteredItems.length === 0 ? (
                        <p className="text-secondary text-center py-8">Aucun plat dans cette catégorie.</p>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredItems.map(item => (
                                <button 
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="relative p-4 rounded-2xl text-left border border-slate-100 hover:border-orange-500 hover:shadow-md bg-white cursor-pointer active:scale-95 transition-all"
                                >
                                    <div className="font-semibold text-primary mb-1 line-clamp-2">{item.name}</div>
                                    <div className="text-orange-600 font-bold">{item.price.toLocaleString('fr-FR')} F</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right side: Ticket / Order */}
            <div className="w-96 bg-white rounded-3xl shadow-premium border border-slate-100 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-orange-600 text-white">
                    <h2 className="text-xl font-bold">Nouveau Ticket</h2>
                    <input 
                        type="text" 
                        placeholder="Table N° ou Client..."
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="mt-3 w-full px-3 py-2 bg-orange-700/50 text-white placeholder-orange-200 rounded-lg outline-none focus:bg-orange-700 transition-colors"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <span className="text-5xl">📝</span>
                            <p>Aucun plat sélectionné</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center group">
                                <div className="flex-1">
                                    <div className="font-medium text-primary text-sm line-clamp-1">{item.name}</div>
                                    <div className="text-xs text-secondary">{item.price.toLocaleString()} F</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                                    >-</button>
                                    <span className="w-4 text-center font-bold text-sm">{item.quantity}</span>
                                    <button 
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-6 h-6 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center font-bold"
                                    >+</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <div className="flex justify-between text-2xl font-bold mb-6">
                        <span className="text-primary">Total</span>
                        <span className="text-orange-600">{cartTotal.toLocaleString('fr-FR')} F</span>
                    </div>
                    <button 
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || createOrderMutation.isPending}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                            cart.length === 0 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                : 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg hover:shadow-xl active:scale-95'
                        }`}
                    >
                        {createOrderMutation.isPending ? 'Envoi...' : 'Envoyer la commande'}
                    </button>
                </div>
            </div>
        </div>
    );
};
