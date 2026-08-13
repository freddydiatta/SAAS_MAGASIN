import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { InvoicePrint } from '../../components/InvoicePrint';

export const Caisse = () => {
    const { selectedBusiness } = useBusiness();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [showInvoice, setShowInvoice] = useState(false);
    const [isFacturing, setIsFacturing] = useState(false);
    const [lastSaleDetails, setLastSaleDetails] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

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

    const handleCheckout = async (withInvoice = false) => {
        if (cart.length === 0) return;
        
        try {
            // 1. Create the receipt
            const { data: receiptData, error: receiptError } = await supabase
                .from('receipts')
                .insert([{
                    business_id: selectedBusiness.id,
                    customer_name: withInvoice ? customerName : null,
                    customer_phone: withInvoice ? customerPhone : null,
                    total_amount: cartTotal,
                    status: 'completed'
                }])
                .select()
                .single();
                
            if (receiptError) throw receiptError;
            
            const receiptId = receiptData.id;

            // 2. Insert sales (line items) and update stock
            for (const item of cart) {
                await supabase.from('sales').insert([{
                    business_id: selectedBusiness.id,
                    receipt_id: receiptId,
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
            }
            
            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
            queryClient.invalidateQueries(['receipts']);
            
            if (withInvoice) {
                setLastSaleDetails({
                    items: [...cart],
                    total: cartTotal,
                    date: new Date(),
                    customerName: customerName || 'Client Comptoir',
                    customerPhone: customerPhone,
                    receiptId: receiptId
                });
                setShowInvoice(true);
            } else {
                showToast('✅ Vente encaissée avec succès !');
            }
            
            setCart([]);
            setCustomerName('');
            setCustomerPhone('');
            setIsFacturing(false);
            
        } catch (error) {
            console.error("Erreur lors de l'encaissement:", error);
            showToast('❌ Erreur lors de l\'encaissement');
        }
    };

    if (showInvoice && lastSaleDetails) {
        return (
            <InvoicePrint 
                invoiceDetails={lastSaleDetails}
                business={selectedBusiness}
                onClose={() => setShowInvoice(false)}
            />
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] flex flex-col lg:flex-row gap-4 lg:gap-6 animate-fade-in-up relative overflow-y-auto lg:overflow-hidden pb-20 lg:pb-0">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg font-medium animate-fade-in-up flex items-center gap-2">
                    {toastMessage}
                </div>
            )}

            {/* Facturation Modal */}
            {isFacturing && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-premium animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-primary">Créer une facture</h2>
                            <button onClick={() => setIsFacturing(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="space-y-4 mb-8">
                            <p className="text-sm text-secondary">Renseignez les informations du client pour la facture. Ces champs sont optionnels.</p>
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">Nom du client</label>
                                <input 
                                    type="text" 
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                                    placeholder="Ex: Jean Dupont"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-primary mb-2">Numéro de téléphone</label>
                                <input 
                                    type="text" 
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full bg-surface border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                                    placeholder="Ex: +221 77 123 45 67"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsFacturing(false)} className="flex-1 btn-secondary bg-slate-100 py-3">Annuler</button>
                            <button onClick={() => handleCheckout(true)} className="flex-[2] btn-primary py-3">Encaisser & Facturer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left side: Products Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden min-h-[500px] lg:min-h-0">
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
            <div className="w-full lg:w-96 bg-white rounded-3xl shadow-premium border border-slate-100 flex flex-col overflow-hidden min-h-[500px] lg:min-h-0">
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
                    <div className="flex justify-between text-lg mb-2 px-2">
                        <span className="text-secondary">Sous-total</span>
                        <span className="font-medium text-primary">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-2xl font-bold mb-6 px-2">
                        <span className="text-primary">Total</span>
                        <span className="text-indigo-600">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleCheckout(false)}
                            disabled={cart.length === 0}
                            className={`flex-[2] py-4 rounded-xl font-bold text-lg transition-all ${
                                cart.length === 0 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl active:scale-95'
                            }`}
                        >
                            Encaisser
                        </button>
                        <button 
                            onClick={() => setIsFacturing(true)}
                            disabled={cart.length === 0}
                            title="Générer une facture"
                            className={`flex-[1] py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all ${
                                cart.length === 0 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl active:scale-95'
                            }`}
                        >
                            📄 Facture
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
