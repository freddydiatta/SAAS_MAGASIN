import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';

export const Caisse = () => {
    const { selectedBusiness } = useBusiness();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    const [cart, setCart] = useState([]);
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

    const createSaleMutation = useMutation({
        mutationFn: async (saleData) => {
            // In a real robust system, we would do this in a transaction or Edge Function
            // 1. Create sale record
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    business_id: selectedBusiness.id,
                    product_id: saleData.items[0].id, // Simplified: assuming one item per sale for this MVP schema, or we map over items
                    quantity: saleData.items[0].quantity,
                    total_price: saleData.total
                }])
                .select()
                .single();
            
            if (saleError) throw saleError;

            // 2. Update stock for the first item
            const item = saleData.items[0];
            const product = products.find(p => p.id === item.id);
            if (product) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ stock_quantity: product.stock_quantity - item.quantity })
                    .eq('id', product.id);
                if (updateError) throw updateError;
            }

            return sale;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
            setCart([]);
            alert('Vente validée avec succès !');
        },
        onError: (error) => {
            console.error('Erreur lors de la vente:', error);
            alert('Erreur lors de la vente. Veuillez réessayer.');
        }
    });

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.id === product.id 
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) return;
        setCart(prev => prev.map(item => 
            item.id === productId ? { ...item, quantity: newQuantity } : item
        ));
    };

    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    const handleCheckout = () => {
        if (cart.length === 0) return;
        // Due to the simplified schema, we will loop and insert each as a separate sale record
        // since we didn't create a 'sale_items' table.
        // For a real SaaS, we would use an RPC or specific tables.
        // Let's do it simply by mutating for the first item (or better, loop)
        
        // Quick MVP hack: we process the whole cart. But since the mutation expects 1 item,
        // we'll update the mutation to handle multiple items if needed, or just iterate.
        // Let's iterate here to keep it simple:
        cart.forEach(async (item) => {
            await supabase.from('sales').insert([{
                business_id: selectedBusiness.id,
                product_id: item.id,
                quantity: item.quantity,
                total_price: item.price * item.quantity
            }]);
            
            const product = products.find(p => p.id === item.id);
            if (product) {
                await supabase.from('products').update({ 
                    stock_quantity: product.stock_quantity - item.quantity 
                }).eq('id', item.id);
            }
        });
        
        queryClient.invalidateQueries(['products']);
        queryClient.invalidateQueries(['sales']);
        setCart([]);
        // Use a nice modern toast instead of alert in the future
        alert('Caisse validée avec succès !'); 
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex gap-6 animate-fade-in-up">
            {/* Left side: Products Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <input 
                        type="text" 
                        placeholder="Rechercher pour ajouter à la commande..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field max-w-xl bg-white text-lg py-3"
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <p className="text-secondary text-center py-8">Chargement du catalogue...</p>
                    ) : filteredProducts.length === 0 ? (
                        <p className="text-secondary text-center py-8">Aucun produit ne correspond.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(product => (
                                <button 
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    disabled={product.stock_quantity <= 0}
                                    className={`relative p-4 rounded-2xl text-left border transition-all ${
                                        product.stock_quantity <= 0 
                                            ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' 
                                            : 'border-slate-100 hover:border-indigo-500 hover:shadow-md bg-white cursor-pointer active:scale-95'
                                    }`}
                                >
                                    <div className="font-semibold text-primary mb-1 line-clamp-2">{product.name}</div>
                                    <div className="text-indigo-600 font-bold">{product.price.toLocaleString('fr-FR')} FCFA</div>
                                    <div className="text-xs text-secondary mt-2">
                                        En stock: <span className={product.stock_quantity <= 0 ? 'text-red-500 font-bold' : ''}>{product.stock_quantity}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right side: Cart / POS */}
            <div className="w-96 bg-white rounded-3xl shadow-premium border border-slate-100 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-indigo-600 text-white">
                    <h2 className="text-xl font-bold">Commande en cours</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <span className="text-5xl">🛒</span>
                            <p>Le panier est vide</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-start">
                                    <span className="font-semibold text-primary">{item.name}</span>
                                    <button 
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-1">
                                        <button 
                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                            className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                        >-</button>
                                        <span className="w-4 text-center font-medium">{item.quantity}</span>
                                        <button 
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            className="w-7 h-7 flex items-center justify-center rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                                        >+</button>
                                    </div>
                                    <span className="font-bold text-primary">
                                        {(item.price * item.quantity).toLocaleString('fr-FR')} F
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <div className="flex justify-between text-lg mb-2">
                        <span className="text-secondary">Sous-total</span>
                        <span className="font-medium text-primary">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-2xl font-bold mb-6">
                        <span className="text-primary">Total</span>
                        <span className="text-indigo-600">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <button 
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                            cart.length === 0 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl active:scale-95'
                        }`}
                    >
                        Encaisser {cartTotal > 0 ? `${cartTotal.toLocaleString('fr-FR')} F` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};
