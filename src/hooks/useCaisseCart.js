import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { saveOfflineSale } from '../services/syncService';
import { processSale } from '../services/salesService';
import { addDebt } from '../services/debtsService';
import { invoiceCustomerSchema, firstZodError } from '../lib/validation';

// Tout le cycle panier -> encaissement -> facture de la caisse : état du
// panier, mode de paiement, monnaie à rendre, bascule hors-ligne/en ligne,
// et les infos de la vente qui vient d'être encaissée (pour l'impression).
// Sorti de Caisse.jsx (qui dépassait 550 lignes en mélangeant requêtes,
// mutations et rendu) pour que cette logique soit lisible et testable
// indépendamment de l'affichage.
export function useCaisseCart(selectedBusiness) {
    const queryClient = useQueryClient();

    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [showInvoice, setShowInvoice] = useState(false);
    const [isFacturing, setIsFacturing] = useState(false);
    const [lastSaleDetails, setLastSaleDetails] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [amountReceived, setAmountReceived] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'mobile_money' ou 'credit'

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // useCallback avec une dépendance vide : addToCart ne lit jamais `cart`
    // directement (mise à jour fonctionnelle via setCart(prev => ...)), donc
    // sa référence reste stable pour toujours — nécessaire pour que
    // React.memo sur ProductCard (dans Caisse.jsx) serve à quelque chose.
    const addToCart = useCallback((product) => {
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
    }, []);

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

    const resetAfterSale = () => {
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setAmountReceived('');
        setPaymentMethod('cash');
        setIsFacturing(false);
    };

    const handleCheckout = async (withInvoice = false) => {
        if (cart.length === 0) return;

        // Une vente à crédit devient une dette : il faut savoir à qui elle
        // est due, contrairement à une facture classique où le nom du
        // client reste optionnel.
        if (paymentMethod === 'credit' && !customerName.trim()) {
            showToast('❌ Le nom du client est requis pour une vente à crédit.');
            return;
        }

        try {
            if (!navigator.onLine) {
                // HORS-LIGNE
                const newReceipt = await saveOfflineSale(selectedBusiness.id, cart, customerName, customerPhone, cartTotal, paymentMethod);
                queryClient.invalidateQueries(['offlineSalesPending']);

                // Mettre à jour le cache local des ventes
                queryClient.setQueryData(['receipts', selectedBusiness.id], (old) => {
                    return [newReceipt, ...(old || [])];
                });

                // Mettre à jour le cache local des lignes de ventes pour le dashboard
                const newSales = cart.map(item => ({
                    id: 'temp-sale-' + Date.now() + Math.random(),
                    business_id: selectedBusiness.id,
                    receipt_id: newReceipt.id,
                    product_id: item.id,
                    quantity: item.quantity,
                    total_price: item.price * item.quantity,
                    created_at: new Date().toISOString(),
                    products: { name: item.name, type: item.type },
                    receipts: { status: 'completed' }
                }));
                queryClient.setQueryData(['sales', selectedBusiness.id], (old) => {
                    return [...newSales, ...(old || [])];
                });

                // Décrémenter virtuellement le stock
                queryClient.setQueryData(['products', selectedBusiness.id], (old) => {
                    if (!old) return old;
                    let newProducts = [...old];
                    for (let item of cart) {
                        const idx = newProducts.findIndex(p => p.id === item.id);
                        if (idx !== -1) {
                            newProducts[idx] = { ...newProducts[idx], stock_quantity: newProducts[idx].stock_quantity - item.quantity };
                        }
                    }
                    return newProducts;
                });

                if (withInvoice) {
                    setLastSaleDetails({
                        items: [...cart],
                        total: cartTotal,
                        date: new Date(),
                        customerName: customerName || 'Client Comptoir',
                        customerPhone: customerPhone,
                        receiptId: newReceipt.id
                    });
                    setShowInvoice(true);
                } else {
                    showToast('⏳ Vente enregistrée hors-ligne (sera synchronisée).');
                }

                resetAfterSale();
                return;
            }

            // EN LIGNE
            // Création de la vente (reçu + lignes + décrément du stock) en une seule
            // transaction côté base de données, pour éviter tout état incohérent si
            // une étape échoue en cours de route, et pour empêcher la survente en cas
            // de ventes concurrentes (voir supabase/patches/2026-08-21_critical_fixes.sql).
            const needsCustomerInfo = withInvoice || paymentMethod === 'credit';
            const { data: receiptData, error: receiptError } = await processSale({
                businessId: selectedBusiness.id,
                customerName: needsCustomerInfo ? customerName : null,
                customerPhone: needsCustomerInfo ? customerPhone : null,
                paymentMethod,
                items: cart.map(item => ({ product_id: item.id, quantity: item.quantity }))
            });

            if (receiptError) throw receiptError;

            const receiptId = receiptData.id;

            // La vente elle-même a réussi (stock déjà décrémenté) : si
            // l'enregistrement de la dette échoue (réseau), on le signale
            // sans faire croire que l'encaissement lui-même a échoué — et
            // sans laisser le toast de succès générique l'écraser juste après.
            let debtRegistrationFailed = false;
            if (paymentMethod === 'credit') {
                try {
                    await addDebt({
                        businessId: selectedBusiness.id,
                        customerName,
                        customerPhone,
                        amount: receiptData.total_amount,
                        note: 'Vente à crédit',
                    });
                    queryClient.invalidateQueries(['debts', selectedBusiness.id]);
                } catch (debtError) {
                    console.error("Erreur lors de l'enregistrement de la dette:", debtError.message);
                    debtRegistrationFailed = true;
                }
            }

            // Optimistic update for immediate dashboard reflection
            const onlineNewSales = cart.map(item => ({
                id: 'temp-sale-' + Date.now() + Math.random(),
                business_id: selectedBusiness.id,
                receipt_id: receiptId,
                product_id: item.id,
                quantity: item.quantity,
                total_price: item.price * item.quantity,
                created_at: new Date().toISOString(),
                products: { name: item.name, type: item.type },
                receipts: { status: 'completed', payment_method: paymentMethod }
            }));
            queryClient.setQueryData(['sales', selectedBusiness.id], (old) => {
                return [...onlineNewSales, ...(old || [])];
            });

            queryClient.invalidateQueries(['products']);
            queryClient.invalidateQueries(['sales']);
            queryClient.invalidateQueries(['receipts']);

            // Note : basculer showInvoice remplace tout l'écran caisse par
            // InvoicePrint, donc un toast n'y serait jamais visible — l'alerte
            // de dette échouée ne s'affiche que dans le cas sans facture.
            if (withInvoice) {
                setLastSaleDetails({
                    items: [...cart],
                    total: receiptData.total_amount,
                    date: new Date(),
                    customerName: customerName || 'Client Comptoir',
                    customerPhone: customerPhone,
                    receiptId: receiptId
                });
                setShowInvoice(true);
            } else if (debtRegistrationFailed) {
                showToast("⚠️ Vente encaissée, mais la dette n'a pas pu être enregistrée.");
            } else {
                showToast(paymentMethod === 'credit' ? '✅ Vente à crédit enregistrée !' : '✅ Vente encaissée avec succès !');
            }

            resetAfterSale();

        } catch (error) {
            console.error("Erreur lors de l'encaissement:", error.message);
            showToast('❌ Erreur lors de l\'encaissement');
        }
    };

    const handleFacturationSubmit = () => {
        const result = invoiceCustomerSchema.safeParse({ customerName, customerPhone });
        if (!result.success) {
            showToast(`❌ ${firstZodError(result)}`);
            return;
        }
        handleCheckout(true);
    };

    return {
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        cartTotal,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        showInvoice,
        setShowInvoice,
        isFacturing,
        setIsFacturing,
        lastSaleDetails,
        toastMessage,
        amountReceived,
        setAmountReceived,
        paymentMethod,
        setPaymentMethod,
        handleCheckout,
        handleFacturationSubmit,
    };
}
