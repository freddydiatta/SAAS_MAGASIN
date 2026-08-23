import { useState, useMemo, memo } from 'react';
import { useBusiness } from '../../contexts/BusinessContext';
import { useProducts } from '../../hooks/useProducts';
import { useCaisseCart } from '../../hooks/useCaisseCart';
import { InvoicePrint } from '../../components/InvoicePrint';
import { Plus, Minus, Search, X, Package, ShoppingBag, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../components/Modal';

export const Caisse = () => {
    const { selectedBusiness } = useBusiness();

    const [searchTerm, setSearchTerm] = useState('');

    const {
        cart, addToCart, removeFromCart, updateQuantity, cartTotal,
        customerName, setCustomerName,
        customerPhone, setCustomerPhone,
        showInvoice, setShowInvoice,
        isFacturing, setIsFacturing,
        lastSaleDetails,
        toastMessage,
        amountReceived, setAmountReceived,
        paymentMethod, setPaymentMethod,
        handleCheckout,
        handleFacturationSubmit,
    } = useCaisseCart(selectedBusiness);

    const { data: products = [], isLoading } = useProducts(selectedBusiness?.id);

    // Mémoïsé : ce filtre re-scannerait tout le catalogue à chaque frappe
    // dans la recherche sinon, ce qui deviendrait sensible sur un catalogue
    // de plusieurs centaines de références.
    const filteredProducts = useMemo(
        () => products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [products, searchTerm]
    );

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
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 animate-fade-in-up relative lg:h-[calc(100vh-5rem)] lg:overflow-hidden pb-20 lg:pb-0">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg font-medium animate-fade-in-up flex items-center gap-2">
                    {toastMessage}
                </div>
            )}

            {/* Facturation Modal */}
            <Modal isOpen={isFacturing} onClose={() => setIsFacturing(false)} title="Créer une facture">
                <div className="space-y-4 mb-8">
                    <p className="text-sm text-secondary">Renseignez les informations du client pour la facture. Ces champs sont optionnels.</p>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-2">Nom du client</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow text-primary"
                            placeholder="Ex: Jean Dupont"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-primary mb-2">Numéro de téléphone</label>
                        <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full bg-surface border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow text-primary"
                            placeholder="Ex: +221 77 123 45 67"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsFacturing(false)} className="flex-1 btn-secondary py-3 text-center">Annuler</button>
                    <button onClick={handleFacturationSubmit} className="flex-[2] btn-primary py-3 text-center shadow-premium">Encaisser & Facturer</button>
                </div>
            </Modal>

            {/* Left side: Products Grid */}
            <div className="flex-1 flex flex-col bg-transparent lg:min-h-0">
                <div className="mb-6 relative">
                    <input
                        type="text"
                        placeholder="Scanner ou rechercher un article..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-panel shadow-premium-lg rounded-full py-4 px-6 pl-14 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all border border-slate-100/50 dark:border-border-theme text-primary placeholder:text-slate-400"
                    />
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                </div>

                <div className="flex-1 overflow-y-auto pb-6">
                    {isLoading ? (
                        <p className="text-secondary text-center py-8">Chargement du catalogue...</p>
                    ) : filteredProducts.length === 0 ? (
                        <p className="text-secondary text-center py-8">Aucun produit ne correspond.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                            {filteredProducts.map(product => (
                                <ProductCard key={product.id} product={product} onAdd={addToCart} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right side: Cart / POS */}
            <div className="w-full lg:w-[400px] bg-panel rounded-3xl shadow-premium border border-slate-100 dark:border-border-theme flex flex-col overflow-hidden min-h-[400px] lg:min-h-0 shrink-0">
                <div className="px-6 py-5 bg-accent text-white flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                    <h2 className="text-lg font-bold relative z-10 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5" /> Commande en cours
                    </h2>
                    <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-medium relative z-10">
                        {cart.length === 0 ? "Aucun article" : `${cart.length} article${cart.length > 1 ? 's' : ''}`}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/50 dark:bg-panel custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                                <ShoppingBag className="w-10 h-10 opacity-50" />
                            </div>
                            <p className="font-medium">Le panier est vide</p>
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
                                    className="flex flex-col gap-3 p-4 bg-panel rounded-2xl border border-slate-100 dark:border-border-theme shadow-sm"
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="font-bold text-primary leading-tight">{item.name}</span>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            aria-label="Retirer du panier"
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-end mt-1">
                                        <div className="flex items-center gap-1 bg-surface dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-border-theme">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                aria-label="Diminuer la quantité"
                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-secondary transition-all"
                                            ><Minus className="w-4 h-4" /></button>
                                            <span className="w-8 text-center font-bold text-primary">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                aria-label="Augmenter la quantité"
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 shadow-sm text-accent font-bold transition-all"
                                            ><Plus className="w-4 h-4" /></button>
                                        </div>
                                        <span className="font-bold text-primary text-lg">
                                            {(item.price * item.quantity).toLocaleString('fr-FR')} F
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                <div className="p-6 bg-panel border-t border-slate-100 dark:border-border-theme">
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-secondary font-medium">Sous-total</span>
                            <span className="font-bold text-primary">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div className="flex justify-between text-2xl font-bold">
                            <span className="text-primary">Total</span>
                            <span className="text-accent">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Mode de paiement</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setPaymentMethod('cash'); setAmountReceived(''); }}
                                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${paymentMethod === 'cash' ? 'bg-blue-100 text-blue-600 border-blue-500' : 'bg-surface dark:bg-slate-800 text-secondary border-transparent hover:border-slate-300'}`}
                            >
                                💵 Espèces
                            </button>
                            <button
                                onClick={() => { setPaymentMethod('mobile_money'); setAmountReceived(''); }}
                                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${paymentMethod === 'mobile_money' ? 'bg-orange-100 text-orange-600 border-orange-500' : 'bg-surface dark:bg-slate-800 text-secondary border-transparent hover:border-slate-300'}`}
                            >
                                📱 Mobile Money
                            </button>
                        </div>
                    </div>

                    {paymentMethod === 'cash' && (
                        <div className="mb-6 animate-fade-in-up">
                            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Montant reçu du client</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amountReceived}
                                    onChange={(e) => setAmountReceived(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-panel dark:bg-slate-800 border border-slate-200 dark:border-border-theme rounded-xl px-4 py-3 text-xl font-bold text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary font-medium">FCFA</span>
                            </div>

                            {amountReceived && cartTotal > 0 && (
                                <div className="mt-4 p-4 rounded-xl flex justify-between items-center bg-surface dark:bg-slate-800 border border-slate-100 dark:border-border-theme">
                                    {Number(amountReceived) >= cartTotal ? (
                                        <>
                                            <span className="font-semibold text-secondary">Monnaie à rendre :</span>
                                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                                {(Number(amountReceived) - cartTotal).toLocaleString('fr-FR')} FCFA
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-semibold text-secondary">Reste à payer :</span>
                                            <span className="text-xl font-bold text-red-500">
                                                {(cartTotal - Number(amountReceived)).toLocaleString('fr-FR')} FCFA
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => handleCheckout(false)}
                            disabled={cart.length === 0 || (paymentMethod === 'cash' && (!amountReceived || Number(amountReceived) < cartTotal))}
                            className={`flex-[3] py-4 rounded-xl font-bold text-lg transition-all flex justify-center items-center ${
                                cart.length === 0 || (paymentMethod === 'cash' && (!amountReceived || Number(amountReceived) < cartTotal))
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    : 'bg-primary text-white hover:opacity-90 shadow-premium active:scale-95'
                            }`}
                        >
                            Encaisser
                        </button>
                        <button
                            onClick={() => setIsFacturing(true)}
                            disabled={cart.length === 0 || (paymentMethod === 'cash' && (!amountReceived || Number(amountReceived) < cartTotal))}
                            title="Générer une facture"
                            className={`flex-[1] py-4 rounded-xl font-bold flex items-center justify-center transition-all ${
                                cart.length === 0 || (paymentMethod === 'cash' && (!amountReceived || Number(amountReceived) < cartTotal))
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    : 'bg-surface dark:bg-slate-800 text-primary border border-slate-200 dark:border-border-theme hover:border-accent hover:text-accent shadow-sm active:scale-95'
                            }`}
                        >
                            <FileText className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Mémoïsé : sans ça, ajouter un article au panier ou changer sa quantité
// re-rendrait toute la grille de produits (potentiellement des centaines
// de cartes) à chaque fois, alors que rien n'y change visuellement.
const ProductCard = memo(function ProductCard({ product, onAdd }) {
    return (
        <motion.button
            whileHover={product.stock_quantity > 0 ? { scale: 1.02, y: -2 } : {}}
            whileTap={product.stock_quantity > 0 ? { scale: 0.98 } : {}}
            onClick={() => onAdd(product)}
            disabled={product.stock_quantity <= 0}
            className={`group flex flex-col relative rounded-2xl text-left transition-all overflow-hidden ${
                product.stock_quantity <= 0
                    ? 'opacity-50 cursor-not-allowed grayscale'
                    : 'bg-panel shadow-premium hover:shadow-premium-lg cursor-pointer border border-transparent hover:border-accent/30'
            }`}
        >
            {/* Photo du produit, ou pastille "à venir" si aucune n'a été ajoutée */}
            <div className="w-full aspect-square bg-orange-50 dark:bg-accent/10 flex items-center justify-center p-3 sm:p-4">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover rounded-xl"
                    />
                ) : (
                    <div className="w-full h-full border-2 border-dashed border-orange-200 dark:border-accent/30 rounded-xl flex items-center justify-center">
                        <Package className="w-6 h-6 sm:w-8 sm:h-8 text-orange-300 dark:text-accent/50 opacity-50" />
                    </div>
                )}
            </div>
            <div className="p-3 sm:p-4 flex flex-col flex-1">
                <div className="font-semibold text-primary mb-1 line-clamp-2 leading-tight text-sm sm:text-base">{product.name}</div>
                <div className="mt-auto pt-2 flex flex-col xl:flex-row xl:items-end justify-between gap-1">
                    <div className="text-accent font-bold text-sm sm:text-lg whitespace-nowrap">{product.price.toLocaleString('fr-FR')} F</div>
                    <div className="text-xs text-secondary font-medium">
                        Stock: <span className={product.stock_quantity <= 0 ? 'text-red-500 font-bold' : ''}>{product.stock_quantity}</span>
                    </div>
                </div>
            </div>
        </motion.button>
    );
});
